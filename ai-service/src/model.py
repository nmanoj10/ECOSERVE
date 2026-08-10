import torch
import torch.nn as nn
import torchvision.models as models

class FoodClassifier(nn.Module):
    """
    Food Classifier model supporting transfer learning.
    Backbones supported:
    - efficientnet_b0 (default)
    - efficientnet_b2
    - mobilenet_v3_large
    """
    def __init__(self, model_name="efficientnet_b0", num_classes=20, pretrained=True, dropout_rate=0.3):
        super(FoodClassifier, self).__init__()
        self.model_name = model_name
        self.num_classes = num_classes
        
        # Load the base backbone
        if model_name == "efficientnet_b0":
            weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
            self.backbone = models.efficientnet_b0(weights=weights)
            in_features = self.backbone.classifier[1].in_features
            self.backbone.classifier = nn.Sequential(
                nn.Dropout(p=dropout_rate, inplace=True),
                nn.Linear(in_features, num_classes)
            )
            
        elif model_name == "efficientnet_b2":
            weights = models.EfficientNet_B2_Weights.DEFAULT if pretrained else None
            self.backbone = models.efficientnet_b2(weights=weights)
            in_features = self.backbone.classifier[1].in_features
            self.backbone.classifier = nn.Sequential(
                nn.Dropout(p=dropout_rate, inplace=True),
                nn.Linear(in_features, num_classes)
            )
            
        elif model_name == "mobilenet_v3_large":
            weights = models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
            self.backbone = models.mobilenet_v3_large(weights=weights)
            in_features = self.backbone.classifier[3].in_features
            self.backbone.classifier[3] = nn.Linear(in_features, num_classes)
            
        else:
            raise ValueError(f"Unsupported model backbone: {model_name}. "
                             f"Supported: 'efficientnet_b0', 'efficientnet_b2', 'mobilenet_v3_large'")
            
    def forward(self, x):
        return self.backbone(x)
        
    def freeze_backbone(self):
        """
        Freezes all parameters except for the classification head.
        """
        # Freeze all parameters first
        for param in self.backbone.parameters():
            param.requires_grad = False
            
        # Unfreeze classifier parameters
        if "efficientnet" in self.model_name:
            for param in self.backbone.classifier.parameters():
                param.requires_grad = True
        elif "mobilenet_v3" in self.model_name:
            for param in self.backbone.classifier[3].parameters():
                param.requires_grad = True
                
    def unfreeze_deeper_layers(self):
        """
        Unfreezes deeper layers for fine-tuning.
        For EfficientNet, we will unfreeze features.stage7 and features.stage8, and the classifier.
        For MobileNetV3, we will unfreeze features[15] and features[16].
        """
        # First ensure everything is unfrozen, then freeze early layers (or just unfreeze specific deep parts)
        # To make it simple and robust, we unfreeze the whole model but keep batchnorm statistics frozen,
        # or we just unfreeze the last few stages.
        # Let's unfreeze the last 2 feature stages and the classifier head.
        
        # Unfreeze all first
        for param in self.backbone.parameters():
            param.requires_grad = True
            
        # Freeze early features stages (e.g. stages 0 to 5 for efficientnet_b0)
        if self.model_name == "efficientnet_b0" or self.model_name == "efficientnet_b2":
            # EfficientNet has self.backbone.features which is a Sequential of blocks
            # We want to freeze stages 0 to 5, and keep stages 6, 7, 8 unfrozen.
            # features is a sequential of 9 blocks: 0 to 8
            for i, child in enumerate(self.backbone.features):
                if i < 6:
                    for param in child.parameters():
                        param.requires_grad = False
                        
        elif self.model_name == "mobilenet_v3_large":
            # MobileNetV3 has self.backbone.features
            # We want to freeze features up to index 12, leaving index 13, 14, 15, 16 unfrozen.
            for i, child in enumerate(self.backbone.features):
                if i < 13:
                    for param in child.parameters():
                        param.requires_grad = False

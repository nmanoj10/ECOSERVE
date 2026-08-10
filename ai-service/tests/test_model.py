import os
import sys
import unittest
import torch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.model import FoodClassifier

class TestModel(unittest.TestCase):
    def test_model_initialization(self):
        num_classes = 15
        model = FoodClassifier(model_name="efficientnet_b0", num_classes=num_classes, pretrained=False)
        self.assertEqual(model.num_classes, num_classes)
        
        # Test forward pass with dummy tensor
        dummy_input = torch.randn(2, 3, 224, 224)
        output = model(dummy_input)
        self.assertEqual(output.shape, (2, num_classes))
        
    def test_freeze_backbone(self):
        model = FoodClassifier(model_name="efficientnet_b0", num_classes=10, pretrained=False)
        model.freeze_backbone()
        
        # Check that backbone features parameters are frozen
        for param in model.backbone.features.parameters():
            self.assertFalse(param.requires_grad)
            
        # Check that classifier head parameters are unfrozen
        for param in model.backbone.classifier.parameters():
            self.assertTrue(param.requires_grad)
            
    def test_unfreeze_deeper_layers(self):
        model = FoodClassifier(model_name="efficientnet_b0", num_classes=10, pretrained=False)
        model.freeze_backbone()
        model.unfreeze_deeper_layers()
        
        # Stage 7 and 8 should be unfrozen
        for param in model.backbone.features[8].parameters():
            self.assertTrue(param.requires_grad)
            
        # Stage 0 should still be frozen
        for param in model.backbone.features[0].parameters():
            self.assertFalse(param.requires_grad)

if __name__ == "__main__":
    unittest.main()

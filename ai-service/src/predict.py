import os
import sys
import json
import argparse
import yaml
import torch
from PIL import Image

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import config
from src.quality_check import validate_image_quality
from src.preprocessing import get_inference_transforms
from src.model import FoodClassifier

def predict_image(image_path, model_path, config_threshold=0.70, generate_cam=False):
    """
    Validates image quality, runs the food classification model,
    returns predictions and optionally generates a Grad-CAM heatmap.
    """
    # 1. Quality check
    quality = validate_image_quality(image_path)
    if not quality['success']:
        return {
            "success": False,
            "error": f"Image quality insufficient for reliable prediction: {quality['error']}"
        }
        
    # 2. Check if model exists
    if not os.path.exists(model_path):
        return {
            "success": False,
            "error": f"Model file not found at {model_path}"
        }
        
    device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else "cpu"))
    
    # 3. Load model checkpoint
    checkpoint = torch.load(model_path, map_location=device)
    class_names = checkpoint['class_names']
    model_name = checkpoint.get('model_name', 'efficientnet_b0')
    num_classes = checkpoint.get('num_classes', len(class_names))
    
    model = FoodClassifier(model_name=model_name, num_classes=num_classes, pretrained=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.to(device)
    model.eval()
    
    # 4. Preprocess image
    image = Image.open(image_path).convert('RGB')
    image_size = config.image_size if (config and hasattr(config, 'image_size')) else 224
    transform = get_inference_transforms(image_size)
    input_tensor = transform(image).unsqueeze(0).to(device)
    
    # 5. Forward pass
    with torch.no_grad():
        outputs = model(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        
    top_probs, top_indices = torch.topk(probabilities, min(5, len(class_names)))
    top_probs = top_probs.cpu().numpy()
    top_indices = top_indices.cpu().numpy()
    
    top_class_name = class_names[top_indices[0]]
    top_prob = float(top_probs[0])
    
    uncertain = False
    food_class = top_class_name
    
    if top_prob < config_threshold:
        uncertain = True
        food_class = "Unknown"
        
    top_predictions = [
        {"class": class_names[idx], "probability": round(float(prob), 4)}
        for prob, idx in zip(top_probs, top_indices)
    ]
    
    version_str = "v2" if "v2" in os.path.basename(model_path) else "v1"
    
    result = {
        "success": True,
        "model_version": version_str,
        "food_class": food_class,
        "predicted_class_raw": top_class_name,
        "confidence": round(top_prob, 4),
        "uncertain": uncertain,
        "top_predictions": top_predictions
    }
    
    # 6. Grad-CAM generation
    if generate_cam:
        from src.gradcam import save_gradcam_result
        if model_name == "efficientnet_b0" or model_name == "efficientnet_b2":
            target_layer = model.backbone.features[8]
        elif model_name == "mobilenet_v3_large":
            target_layer = model.backbone.features[16]
        else:
            target_layer = None
            
        if target_layer:
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if "best_food_classifier_v2.pth" in model_path:
                reports_dir = os.path.join(project_root, "reports", "gradcam_v2")
            else:
                reports_dir = os.path.join(project_root, "reports", "gradcam")
                
            os.makedirs(reports_dir, exist_ok=True)
            cam_filename = f"gradcam_{os.path.basename(image_path)}"
            cam_path = os.path.join(reports_dir, cam_filename)
            
            save_gradcam_result(
                model=model,
                target_layer=target_layer,
                input_tensor=input_tensor,
                original_image_path=image_path,
                save_path=cam_path,
                class_idx=int(top_indices[0]),
                class_names=class_names
            )
            result["gradcam_path"] = cam_path
            
    return result

def main():
    parser = argparse.ArgumentParser(description="ECOSERVE Food Classifier Inference Tool")
    parser.add_argument("--image", type=str, required=True, help="Path to input image file")
    parser.add_argument("--model", type=str, default="v2", help="Model to use ('v1', 'v2' or absolute path to .pth)")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    parser.add_argument("--gradcam", action="store_true", help="Generate Grad-CAM heatmap visualization")
    args = parser.parse_args()
    
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Resolve model paths
    model_arg = args.model
    if model_arg == "v1":
        model_path = os.path.join(project_root, "models", "best_food_classifier.pth")
    elif model_arg == "v2":
        model_path = os.path.join(project_root, "models", "best_food_classifier_v2.pth")
    elif os.path.exists(model_arg):
        model_path = model_arg
    else:
        # check if model_arg exists in models folder
        model_path = os.path.join(project_root, "models", model_arg)
        if not os.path.exists(model_path):
            # fallback to v2
            model_path = os.path.join(project_root, "models", "best_food_classifier_v2.pth")
            
    conf_threshold = config.confidence_threshold if config else 0.70
    
    res = predict_image(args.image, model_path, conf_threshold, args.gradcam)
    
    if args.json:
        print(json.dumps(res, indent=4))
    else:
        if not res["success"]:
            print(f"Error: {res['error']}")
            sys.exit(1)
            
        print("============================================================")
        print("FOOD PREDICTION")
        print("============================================================")
        print(f"Food Class:\n{res['food_class']}")
        print(f"\nConfidence:\n{res['confidence'] * 100:.2f}%")
        print(f"\nUncertain:\n{'Yes' if res['uncertain'] else 'No'}")
        
        print("\nTop 5 Predictions:")
        for idx, pred in enumerate(res["top_predictions"], 1):
            print(f"{idx}. {pred['class']} - {pred['probability'] * 100:.2f}%")
        print("============================================================")
        
        if "gradcam_path" in res:
            print(f"Grad-CAM Heatmap saved to: {res['gradcam_path']}")

if __name__ == "__main__":
    main()

import os
import numpy as np
import torch
import matplotlib.pyplot as plt
from PIL import Image

class GradCAM:
    """
    Native PyTorch Grad-CAM implementation.
    Does not require third-party compiled packages (like opencv-python or pytorch-grad-cam),
    making it highly stable and cross-platform.
    """
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        # Register hooks
        self.forward_hook = self.target_layer.register_forward_hook(self.save_activation)
        self.backward_hook = self.target_layer.register_full_backward_hook(self.save_gradient)
        
    def save_activation(self, module, input, output):
        self.activations = output
        
    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0]
        
    def remove_hooks(self):
        """
        Removes the registered hooks.
        """
        self.forward_hook.remove()
        self.backward_hook.remove()
        
    def generate_heatmap(self, input_tensor, class_idx=None):
        """
        Generates a Grad-CAM heatmap for the specified input tensor and class index.
        """
        self.model.eval()
        
        # Forward pass
        output = self.model(input_tensor)
        
        if class_idx is None:
            class_idx = torch.argmax(output, dim=1).item()
            
        self.model.zero_grad()
        
        # Backward pass
        loss = output[0, class_idx]
        loss.backward()
        
        # Extract gradients and activations
        gradients = self.gradients.detach().cpu().numpy()[0]  # shape: [C, H, W]
        activations = self.activations.detach().cpu().numpy()[0]  # shape: [C, H, W]
        
        # Global average pooling of gradients
        weights = np.mean(gradients, axis=(1, 2))  # shape: [C]
        
        # Weighted sum of activations
        cam = np.zeros(activations.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * activations[i]
            
        # Apply ReLU
        cam = np.maximum(cam, 0)
        
        # Normalize between 0 and 1
        if cam.max() > 0:
            cam = cam / cam.max()
            
        return cam, class_idx

def overlay_heatmap(original_image_path, heatmap, alpha=0.5, colormap='jet'):
    """
    Overlays a Grad-CAM heatmap onto the original image.
    Uses matplotlib to apply colormap and blend, avoiding cv2 dependency.
    """
    # Load original image
    orig_img = Image.open(original_image_path).convert('RGB')
    width, height = orig_img.size
    
    # Resize heatmap to match original image size
    cam_img = Image.fromarray((heatmap * 255).astype(np.uint8))
    cam_img = cam_img.resize((width, height), resample=Image.BILINEAR)
    cam_arr = np.array(cam_img) / 255.0
    
    # Apply colormap (using matplotlib's colormap)
    cm = plt.get_cmap(colormap)
    colored_cam = cm(cam_arr)[:, :, :3]  # Drop alpha channel of colormap
    
    # Blend image and heatmap
    orig_arr = np.array(orig_img) / 255.0
    blended = alpha * colored_cam + (1 - alpha) * orig_arr
    blended = np.clip(blended, 0, 1)
    
    # Convert back to PIL Image
    blended_img = Image.fromarray((blended * 255).astype(np.uint8))
    return blended_img

def save_gradcam_result(model, target_layer, input_tensor, original_image_path, save_path, class_idx=None, class_names=None):
    """
    Generates, overlays, and saves a Grad-CAM visualization.
    """
    grad_cam = GradCAM(model, target_layer)
    try:
        heatmap, pred_idx = grad_cam.generate_heatmap(input_tensor, class_idx)
        blended_img = overlay_heatmap(original_image_path, heatmap)
        
        # Create output directory if needed
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        # Plot and save
        fig, axes = plt.subplots(1, 2, figsize=(10, 5))
        axes[0].imshow(Image.open(original_image_path))
        axes[0].set_title("Original Image")
        axes[0].axis('off')
        
        pred_label = class_names[pred_idx] if class_names else f"Class {pred_idx}"
        axes[1].imshow(blended_img)
        axes[1].set_title(f"Grad-CAM (Attention: {pred_label})")
        axes[1].axis('off')
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
    finally:
        grad_cam.remove_hooks()
        
    return pred_idx

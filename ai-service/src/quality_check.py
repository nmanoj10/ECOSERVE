import os
from PIL import Image
import numpy as np

def validate_image_quality(image_path, min_dim=100, dark_threshold=15, bright_threshold=240):
    """
    Validates the quality of a food image before inference.
    Checks:
    - File existence
    - Supported extensions (.jpg, .jpeg, .png, .webp)
    - Successful loading with Pillow
    - Minimum dimensions (min_dim x min_dim)
    - Extreme brightness/darkness (average pixel intensity)
    
    Returns:
        dict: {"success": bool, "error": str or None}
    """
    # 1. Check file exists
    if not os.path.exists(image_path):
        return {"success": False, "error": "Image file does not exist"}
        
    # 2. Check extension
    ext = os.path.splitext(image_path)[1].lower()
    supported_extensions = ['.jpg', '.jpeg', '.png', '.webp']
    if ext not in supported_extensions:
        return {"success": False, "error": f"Unsupported image format: {ext}. Supported formats: {supported_extensions}"}
        
    # 3. Try opening the image
    try:
        with Image.open(image_path) as img:
            img.verify()  # Verify integrity
    except Exception as e:
        return {"success": False, "error": f"Image file is corrupted or unreadable: {str(e)}"}
        
    # Reopen to check dimensions and brightness (verify closes the file/requires reopening)
    try:
        with Image.open(image_path) as img:
            width, height = img.size
            
            # 4. Check dimensions
            if width < min_dim or height < min_dim:
                return {"success": False, "error": f"Image resolution too low ({width}x{height}). Minimum required: {min_dim}x{min_dim}."}
                
            # Convert to grayscale to check brightness
            img_gray = img.convert('L')
            pixels = np.array(img_gray)
            mean_brightness = np.mean(pixels)
            
            # 5. Check extremely dark
            if mean_brightness < dark_threshold:
                return {"success": False, "error": f"Image is too dark (average brightness: {mean_brightness:.1f}/{bright_threshold})."}
                
            # 6. Check extremely bright
            if mean_brightness > bright_threshold:
                return {"success": False, "error": f"Image is too bright (average brightness: {mean_brightness:.1f}/{bright_threshold})."}
                
    except Exception as e:
        return {"success": False, "error": f"Failed to parse image pixel data: {str(e)}"}
        
    return {"success": True, "error": None}

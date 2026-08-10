import os
import sys
import unittest
import numpy as np
from PIL import Image

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.quality_check import validate_image_quality

class TestQualityCheck(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_temp")
        os.makedirs(self.test_dir, exist_ok=True)
        
    def tearDown(self):
        # Clean up temp files
        if os.path.exists(self.test_dir):
            for f in os.listdir(self.test_dir):
                os.remove(os.path.join(self.test_dir, f))
            os.rmdir(self.test_dir)
            
    def create_dummy_image(self, filename, color_value, size=(224, 224), ext=".jpg"):
        path = os.path.join(self.test_dir, filename + ext)
        # Create solid color image
        img = Image.new("RGB", size, color=color_value)
        img.save(path)
        return path

    def test_valid_image(self):
        path = self.create_dummy_image("valid", (128, 128, 128))
        res = validate_image_quality(path)
        self.assertTrue(res["success"])
        self.assertIsNone(res["error"])
        
    def test_missing_file(self):
        res = validate_image_quality("non_existent_file.jpg")
        self.assertFalse(res["success"])
        self.assertIn("does not exist", res["error"])
        
    def test_unsupported_format(self):
        path = self.create_dummy_image("invalid_format", (128, 128, 128), ext=".bmp")
        res = validate_image_quality(path)
        self.assertFalse(res["success"])
        self.assertIn("Unsupported image format", res["error"])
        
    def test_resolution_too_low(self):
        path = self.create_dummy_image("low_res", (128, 128, 128), size=(50, 50))
        res = validate_image_quality(path, min_dim=100)
        self.assertFalse(res["success"])
        self.assertIn("resolution too low", res["error"])
        
    def test_too_dark(self):
        path = self.create_dummy_image("dark", (5, 5, 5))
        res = validate_image_quality(path, dark_threshold=15)
        self.assertFalse(res["success"])
        self.assertIn("too dark", res["error"])
        
    def test_too_bright(self):
        path = self.create_dummy_image("bright", (250, 250, 250))
        res = validate_image_quality(path, bright_threshold=240)
        self.assertFalse(res["success"])
        self.assertIn("too bright", res["error"])

if __name__ == "__main__":
    unittest.main()

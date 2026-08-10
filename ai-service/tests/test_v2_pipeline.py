import os
import sys
import json
import torch
import unittest
from PIL import Image

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.predict import predict_image
from src.model import FoodClassifier

class TestV2InferencePipeline(unittest.TestCase):
    def setUp(self):
        self.project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.model_path = os.path.join(self.project_root, "models", "best_food_classifier_v2.pth")
        self.metadata_path = os.path.join(self.project_root, "models", "model_metadata_v2.json")
        self.class_names_path = os.path.join(self.project_root, "models", "class_names_v2.json")
        
        # Temporary test image
        self.test_img_path = os.path.join(self.project_root, "temp_test_img.jpg")
        img = Image.new("RGB", (224, 224), color=(180, 120, 70))
        img.save(self.test_img_path)

    def tearDown(self):
        if os.path.exists(self.test_img_path):
            os.remove(self.test_img_path)

    def test_model_v2_checkpoint_loadable(self):
        self.assertTrue(os.path.exists(self.model_path), f"Model V2 checkpoint not found at {self.model_path}")
        checkpoint = torch.load(self.model_path, map_location='cpu')
        self.assertIn('model_state_dict', checkpoint)
        self.assertIn('class_names', checkpoint)
        self.assertEqual(checkpoint.get('num_classes', len(checkpoint['class_names'])), 20)
        self.assertEqual(len(checkpoint['class_names']), 20)

    def test_metadata_files(self):
        self.assertTrue(os.path.exists(self.metadata_path), "model_metadata_v2.json missing")
        self.assertTrue(os.path.exists(self.class_names_path), "class_names_v2.json missing")
        with open(self.metadata_path, 'r') as f:
            meta = json.load(f)
        self.assertEqual(meta["num_classes"], 20)
        self.assertEqual(len(meta["class_names"]), 20)
        self.assertEqual(meta["model_version"], "v2")

    def test_predict_image_execution(self):
        res = predict_image(self.test_img_path, self.model_path, config_threshold=0.70)
        self.assertTrue(res["success"])
        self.assertEqual(res["model_version"], "v2")
        self.assertIn("food_class", res)
        self.assertIn("confidence", res)
        self.assertIn("top_predictions", res)
        self.assertEqual(len(res["top_predictions"]), 5)

if __name__ == "__main__":
    unittest.main()

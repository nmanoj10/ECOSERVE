import os
import sys
import unittest
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.main import app

class TestAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        
    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertEqual(data["status"], "healthy")
        self.assertIn("model_loaded", data)
        
    def test_predict_endpoint_no_image(self):
        response = self.client.post("/predict")
        self.assertEqual(response.status_code, 422) # Unprocessable Entity (missing file field)

    def test_predict_endpoint_with_image(self):
        import io
        from PIL import Image
        img_byte_arr = io.BytesIO()
        img = Image.new('RGB', (224, 224), color=(180, 100, 40))
        img.save(img_byte_arr, format='JPEG')
        img_byte_arr.seek(0)
        
        response = self.client.post(
            "/predict",
            files={"image": ("test.jpg", img_byte_arr, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["model_version"], "v2")
        self.assertIn("food_class", data)
        self.assertIn("confidence", data)
        self.assertIn("top_predictions", data)
        self.assertEqual(len(data["top_predictions"]), 5)

if __name__ == "__main__":
    unittest.main()

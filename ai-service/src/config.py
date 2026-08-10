import os
import yaml

class Config:
    def __init__(self, config_path="config.yaml"):
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        full_path = os.path.join(project_root, config_path)
        
        if not os.path.exists(full_path):
            full_path = config_path
            
        self._config = {}
        if os.path.exists(full_path):
            try:
                with open(full_path, 'r') as f:
                    self._config = yaml.safe_load(f) or {}
            except Exception:
                self._config = {}
            
        # Model
        model_cfg = self._config.get('model', {})
        self.model_name = model_cfg.get('name', 'efficientnet_b0')
        self.pretrained = model_cfg.get('pretrained', False)
        
        # Training / Preprocessing
        train_cfg = self._config.get('training', {})
        self.image_size = train_cfg.get('image_size', 224)
        self.batch_size = train_cfg.get('batch_size', 16)
        self.epochs = train_cfg.get('epochs', 2)
        self.learning_rate = train_cfg.get('learning_rate', 0.001)
        self.fine_tune_learning_rate = train_cfg.get('fine_tune_learning_rate', 0.00001)
        self.weight_decay = train_cfg.get('weight_decay', 0.0001)
        self.patience = train_cfg.get('patience', 3)
        
        # Inference
        infer_cfg = self._config.get('inference', {})
        self.confidence_threshold = infer_cfg.get('confidence_threshold', 0.70)
        
        # System
        sys_cfg = self._config.get('system', {})
        self.random_seed = sys_cfg.get('random_seed', 42)

# Singleton instance
try:
    config = Config()
except Exception as e:
    print(f"Warning: Could not load configuration: {e}")
    config = None

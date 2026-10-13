"""
Integration Test for YOLOE Prompt-Free WebSocket & FastAPI Endpoints
Tests genuine YOLOE singleton, WebSocket frame inference, and model preservation.
"""

import sys
import base64
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import create_app
from app.core.ai.yoloe_singleton import load_model, is_loaded, get_active_classes

def test_yoloe_singleton_loaded():
    """Verify YOLOE loads and has everyday classes."""
    load_model()
    assert is_loaded() is True
    classes = get_active_classes()
    assert len(classes) >= 10
    assert "laptop" in classes
    assert "person" in classes
    print(f"PASSED: YOLOE singleton loaded with {len(classes)} classes.")

def test_fastapi_detection_status():
    """Verify HTTP detection status endpoint works."""
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/v1/detection/status")
    assert response.status_code == 200
    data = response.json()
    assert "config" in data
    print("PASSED: /api/v1/detection/status returned 200 OK.")

def test_yoloe_websocket_inference():
    """Verify /api/v1/ws/object-detection WebSocket with YOLOE Prompt-Free model."""
    img_path = backend_dir.parent / "laptop.webp"
    if not img_path.exists():
        pytest.skip("laptop.webp not found for test")

    with open(img_path, "rb") as f:
        b64_img = base64.b64encode(f.read()).decode("utf-8")

    app = create_app()
    client = TestClient(app)

    with client.websocket_connect("/api/v1/ws/object-detection") as ws:
        # Send frame with yoloe model
        ws.send_json({
            "frame": f"data:image/webp;base64,{b64_img}",
            "model": "yoloe",
            "confidence": 0.25,
            "auto_save": False,
        })
        resp = ws.receive_json()
        assert "error" not in resp, f"Unexpected WS error: {resp.get('error')}"
        assert resp.get("model") == "yoloe-pf"
        assert "detections" in resp
        assert "inference_ms" in resp
        assert "counts" in resp

        dets = resp["detections"]
        assert len(dets) >= 1, "Expected at least 1 detection on laptop.webp"
        top_name = dets[0]["name"]
        top_conf = dets[0]["confidence"]
        top_box = [dets[0]["x1"], dets[0]["y1"], dets[0]["x2"], dets[0]["y2"]]
        print(f"PASSED: YOLOE WebSocket detected '{top_name}' ({top_conf*100:.1f}%) at {top_box} in {resp['inference_ms']}ms.")

if __name__ == "__main__":
    print("Running YOLOE Integration Tests...")
    test_yoloe_singleton_loaded()
    test_fastapi_detection_status()
    test_yoloe_websocket_inference()
    print("ALL TESTS PASSED SUCCESSFULLY!")

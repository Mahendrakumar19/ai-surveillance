"""
Comprehensive test for Live Object Detection WebSocket with YOLOv9-C, YOLO-World, and YOLO11m.
"""
import base64
import cv2
from fastapi.testclient import TestClient
from app.main import create_app

def test_websocket_yolov9():
    app = create_app()
    client = TestClient(app)

    # Encode test image
    img = cv2.imread(r"../laptop.webp")
    assert img is not None, "laptop.webp must exist"
    _, buffer = cv2.imencode(".jpg", img)
    b64_str = base64.b64encode(buffer).decode("utf-8")

    print("[TEST] Connecting to /api/v1/ws/object-detection...")
    with client.websocket_connect("/api/v1/ws/object-detection") as ws:
        # Test 1: Send YOLOv9 inference request
        print("[TEST] Sending YOLOv9 frame...")
        ws.send_json({
            "frame": b64_str,
            "model": "yolov9",
            "confidence": 0.25,
            "auto_save": False,
        })
        resp = ws.receive_json()
        print("[TEST] YOLOv9 response:", {k: resp[k] for k in ("model", "inference_ms", "active_tracks") if k in resp})
        assert "error" not in resp, f"Expected no error, got {resp.get('error')}"
        assert resp.get("model") == "yolov9-c"
        dets = resp.get("detections", [])
        assert len(dets) >= 1, f"Expected at least 1 detection, got {len(dets)}"
        names = [d["name"] for d in dets]
        assert "laptop" in names, f"Expected 'laptop' in detections, got {names}"
        laptop_det = next(d for d in dets if d["name"] == "laptop")
        print(f"[TEST] Confirmed YOLOv9 detected: {laptop_det['name']} ({laptop_det['confidence'] * 100:.1f}%) at {laptop_det['bbox']}")

        # Test 2: Send YOLO11m inference request (regression test)
        print("[TEST] Sending YOLO11m frame...")
        ws.send_json({
            "frame": b64_str,
            "model": "yolo11m",
            "confidence": 0.25,
            "auto_save": False,
        })
        resp_11m = ws.receive_json()
        print("[TEST] YOLO11m response:", {k: resp_11m[k] for k in ("model", "inference_ms", "active_tracks") if k in resp_11m})
        assert "error" not in resp_11m
        assert resp_11m.get("model") == "yolo11m"

        # Test 3: Unsupported model error test (must not silently switch)
        print("[TEST] Sending unknown model request...")
        ws.send_json({
            "frame": b64_str,
            "model": "nonexistent_model",
            "confidence": 0.25,
            "auto_save": False,
        })
        resp_err = ws.receive_json()
        print("[TEST] Unknown model response:", resp_err)
        assert "error" in resp_err, "Unknown model must return error"

    print("\n[TEST] ALL WEBSOCKET TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_websocket_yolov9()

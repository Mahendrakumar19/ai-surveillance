"""
Integration verification script for ANPR engines, FastAPI endpoints, and duplicate prevention.
"""

import asyncio
import base64
from pathlib import Path
import cv2
from httpx import AsyncClient, ASGITransport

from app.main import create_app
from app.db.session import async_session_factory
from app.db.base import Base
from sqlalchemy import select, func
from app.models.vehicle import VehicleRecord

app = create_app()

async def run_tests():
    print("=" * 60)
    print("RUNNING ANPR INTEGRATION VERIFICATION TESTS")
    print("=" * 60)

    # 1. Ensure DB tables exist
    from app.core.config import settings
    from sqlalchemy.ext.asyncio import create_async_engine
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[1/6] DB tables verified.")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 2. Test GET /api/v1/vehicles/engines
        res = await client.get("/api/v1/vehicles/engines")
        assert res.status_code == 200, f"Engines endpoint failed: {res.text}"
        engines = res.json()
        print(f"[2/6] Engines endpoint OK. Registered engines ({len(engines)}):")
        for e in engines:
            print(f"      - {e['id']}: {e['name']}")
        engine_ids = {e['id'] for e in engines}
        assert "indian_anpr" in engine_ids
        assert "fast_alpr" in engine_ids
        assert "yolo_easyocr" in engine_ids

        # 3. Test POST /api/v1/vehicles/scan with FastALPR on sample plate image
        test_img_path = Path("app/services/anpr/benchmark_data/images/evidence_mh12de1413_1790571418.jpg")
        assert test_img_path.exists(), f"Sample image not found: {test_img_path}"
        with open(test_img_path, "rb") as f:
            b64_str = base64.b64encode(f.read()).decode("utf-8")

        res_fast = await client.post("/api/v1/vehicles/scan", json={
            "image_base64": b64_str,
            "engine": "fast_alpr",
            "camera_name": "Test Gate Camera",
            "location_spot": "Apartment Parking"
        })
        assert res_fast.status_code == 200, f"FastALPR scan failed: {res_fast.text}"
        fast_data = res_fast.json()
        assert fast_data.get("engine") == "fast_alpr", f"Engine silently switched: expected fast_alpr, got {fast_data.get('engine')}"
        print(f"[3/6] FastALPR Scan OK: engine={fast_data['engine']}, success={fast_data['success']}, plate={fast_data.get('number_plate')}, latency={fast_data.get('processing_time_ms')}ms")

        # 4. Test Duplicate Prevention on subsequent scan of identical plate
        scanned_plate = fast_data.get("number_plate")
        if scanned_plate:
            res_dup = await client.post("/api/v1/vehicles/scan", json={
                "image_base64": b64_str,
                "engine": "fast_alpr",
                "camera_name": "Test Gate Camera",
                "location_spot": "Apartment Parking"
            })
            assert res_dup.status_code == 200, f"Duplicate scan failed: {res_dup.status_code} - {res_dup.text}"
            dup_data = res_dup.json()
            print(f"[4/6] Duplicate Prevention Test: already_saved={dup_data.get('already_saved')}, message='{dup_data.get('message')}'")
            assert dup_data.get("already_saved") is True, f"Duplicate prevention failed: {dup_data}"

        # 5. Test Motorcycle Detection on Motorcycle Image
        bike_img_path = Path("app/services/anpr/benchmark_data/images/Apartment_Exit_Gate_Live_ANPR_Camera_20260929_100003_Motorcycle_MH43CC1745.jpg")
        if bike_img_path.exists():
            with open(bike_img_path, "rb") as f:
                bike_b64 = base64.b64encode(f.read()).decode("utf-8")
            res_bike = await client.post("/api/v1/vehicles/scan", json={
                "image_base64": bike_b64,
                "engine": "indian_anpr",
                "camera_name": "Exit Gate Camera",
                "location_spot": "Apartment Exit Gate"
            })
            assert res_bike.status_code == 200
            bike_data = res_bike.json()
            assert bike_data.get("engine") == "indian_anpr", f"Engine silently switched: expected indian_anpr, got {bike_data.get('engine')}"
            print(f"[5/6] Motorcycle Plate Scan: engine={bike_data.get('engine')}, plate={bike_data.get('number_plate')}, type={bike_data.get('vehicle_type')}, latency={bike_data.get('processing_time_ms')}ms")

        # 6. Test GET /api/v1/vehicles/benchmark
        res_bench = await client.get("/api/v1/vehicles/benchmark")
        assert res_bench.status_code == 200, f"Benchmark endpoint failed: {res_bench.text}"
        bench_data = res_bench.json()
        print(f"[6/6] Benchmark Endpoint OK: Total Images={bench_data['total_images']}")
        for k, v in bench_data["engine_summaries"].items():
            print(f"      - {v['name']}: Exact Acc={v['exact_accuracy_pct']}%, Avg Char Acc={v['avg_char_accuracy_pct']}%, Latency={v['avg_latency_ms']}ms")

    print("\nALL INTEGRATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())


import sys
import httpx
import asyncio
import time

async def run_smoke_test():
    print("🔍 Starting Full Stack Smoke Test...")
    
    # In a real E2E environment, we'd get these from env vars
    backend_url = "http://localhost:8001"
    frontend_url = "http://localhost:5174"
    
    print(f"Checking Backend at {backend_url}...")
    try:
        async with httpx.AsyncClient() as client:
            # 1. Health check
            resp = await client.get(f"{backend_url}/")
            if resp.status_code == 200:
                print(f"✅ Backend Health: PASS ({resp.json().get('version')})")
            else:
                print(f"❌ Backend Health: FAIL ({resp.status_code})")
                return False
                
            # 2. Providers check
            resp = await client.get(f"{backend_url}/api/providers")
            if resp.status_code == 200 and "providers" in resp.json():
                print(f"✅ Backend API (Providers): PASS")
            else:
                print(f"❌ Backend API (Providers): FAIL")
                return False
    except Exception as e:
        print(f"❌ Backend unreachable: {e}")
        return False

    print(f"Checking Frontend at {frontend_url}...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(frontend_url)
            if resp.status_code == 200:
                print(f"✅ Frontend Reachability: PASS")
            else:
                print(f"❌ Frontend Reachability: FAIL ({resp.status_code})")
                return False
    except Exception as e:
        print(f"❌ Frontend unreachable: {e}")
        return False

    print("\n🎉 ALL SMOKE TESTS PASSED!")
    return True

if __name__ == "__main__":
    # We expect the servers to be running from dev_start.sh
    success = asyncio.run(run_smoke_test())
    sys.exit(0 if success else 1)

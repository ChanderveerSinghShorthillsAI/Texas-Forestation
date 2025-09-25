#!/usr/bin/env python3
"""
Start the Texas Forestation API server with carbon estimation capabilities
"""

import uvicorn
import sys
import os

if __name__ == "__main__":
    print("🚀 Starting Texas Forestation API Server...")
    print("📍 Including Carbon Estimation endpoints:")
    print("   - /api/carbon/county")
    print("   - /api/carbon/statewide") 
    print("   - /api/carbon/counties/top")
    print("   - /api/carbon/methodology")
    print("   - /api/carbon/health")
    print("\n🌐 Server will be available at: http://localhost:8000")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("\n" + "="*50)
    
    try:
        uvicorn.run(
            "main:app", 
            host="0.0.0.0", 
            port=8000, 
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server failed to start: {e}")

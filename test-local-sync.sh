#!/bin/bash
# Quick test script for local piece sync

echo "🔍 Testing Local Piece Sync Setup"
echo "=================================="
echo ""

# Check if piece is built
if [ -d "dist/packages/pieces/community/flowlytics" ]; then
    echo "✅ Piece is built: dist/packages/pieces/community/flowlytics exists"
    if [ -f "dist/packages/pieces/community/flowlytics/package.json" ]; then
        echo "✅ package.json found in dist"
    else
        echo "❌ package.json missing in dist - rebuild needed"
    fi
    if [ -f "dist/packages/pieces/community/flowlytics/src/index.js" ]; then
        echo "✅ Compiled index.js found"
    else
        echo "❌ Compiled index.js missing - rebuild needed"
    fi
else
    echo "❌ Piece not built - run: nx build flowlytics"
fi

echo ""
echo "📋 Environment Check:"
if [ -z "$AP_PIECES_SOURCE" ]; then
    echo "⚠️  AP_PIECES_SOURCE not set (should be 'DB' for local sync)"
else
    echo "✅ AP_PIECES_SOURCE=$AP_PIECES_SOURCE"
fi

if [ -z "$AP_PIECES_REGISTRY_URL" ]; then
    echo "⚠️  AP_PIECES_REGISTRY_URL not set (should be 'local' for local sync)"
else
    echo "✅ AP_PIECES_REGISTRY_URL=$AP_PIECES_REGISTRY_URL"
fi

if [ -z "$AP_PIECES_SYNC_MODE" ]; then
    echo "ℹ️  AP_PIECES_SYNC_MODE not set (defaults to NONE)"
else
    echo "✅ AP_PIECES_SYNC_MODE=$AP_PIECES_SYNC_MODE"
fi

echo ""
echo "🚀 Next Steps:"
echo "1. Build piece: nx build flowlytics"
echo "2. Set env vars: export AP_PIECES_SOURCE=DB AP_PIECES_REGISTRY_URL=local AP_PIECES_SYNC_MODE=NONE"
echo "3. Start app: npm run dev"
echo "4. Sync pieces: npm run sync:after-dev"
echo "5. Check UI: Platform Admin → Pieces"

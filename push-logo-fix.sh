#!/bin/bash
# Push the logo upload fix to GitHub

echo "🚀 Pushing logo upload fix to GitHub..."
echo ""
echo "Branch: fix/logo-upload-supabase-storage"
echo "Commits: 1 new commit"
echo ""

# Push to GitHub
git push origin fix/logo-upload-supabase-storage

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to https://github.com/Jgabbard61/roblox-tool"
    echo "2. Create a Pull Request to merge into main"
    echo "3. Or merge directly: git checkout main && git merge fix/logo-upload-supabase-storage && git push origin main"
    echo ""
    echo "⚠️  IMPORTANT: Add Supabase anon key to Vercel environment variables!"
    echo "   See SUPABASE_STORAGE_SETUP.md for instructions"
else
    echo ""
    echo "❌ Push failed. You may need to authenticate:"
    echo ""
    echo "Option 1: Use GitHub CLI"
    echo "  gh auth login"
    echo "  git push origin fix/logo-upload-supabase-storage"
    echo ""
    echo "Option 2: Use SSH"
    echo "  git remote set-url origin git@github.com:Jgabbard61/roblox-tool.git"
    echo "  git push origin fix/logo-upload-supabase-storage"
    echo ""
    echo "Option 3: Manually create PR"
    echo "  1. Go to https://github.com/Jgabbard61/roblox-tool"
    echo "  2. Navigate to 'Compare & pull request'"
    echo "  3. Create PR for branch 'fix/logo-upload-supabase-storage'"
fi

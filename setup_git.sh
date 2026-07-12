#!/usr/bin/env bash
# 在你自己的 macOS 终端里运行本脚本,初始化 git 并推送到 GitHub。
# 用法:
#   cd "/Users/tang/Documents/2-探索项目/各种AI玩具/图灵迷局"
#   bash setup_git.sh

set -e
cd "$(dirname "$0")"

REMOTE_URL="https://github.com/thejaytang/Echo-Protocol.git"

echo "==> 清除可能残留的 .git"
rm -rf .git

echo "==> 初始化仓库(默认分支 main)"
git init -b main
git config user.name "Jay"
git config user.email "weijietang2000@gmail.com"

echo "==> 添加文件并首次提交"
git add -A
git commit -m "chore: 初始化 Echo Protocol 仓库"

echo "==> 检查即将提交的内容里没有敏感/冗余文件"
if git ls-files | grep -iE '\.env$|\.npm-cache|node_modules|/dist/|mirage\.dev\.json|settings\.local'; then
  echo "!! 警告:上面这些文件不该进仓库,请检查 .gitignore 后重来。"
  exit 1
fi
echo "   干净。"

echo "==> 连接远程仓库并推送"
git remote add origin "$REMOTE_URL"
git push -u origin main

echo "==> 完成。仓库地址:https://github.com/thejaytang/Echo-Protocol"

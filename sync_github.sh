#!/usr/bin/env bash
# 把本地源码同步到 GitHub 仓库 HANKpy/short-drama-master-h5
#
# 用法：
#   GH_TOKEN=<你的 Personal Access Token> ./sync_github.sh
#
# 什么时候用这个脚本：
#   正常网络下直接 `git push` 就行。但某些代理环境会掐断 git 的大 POST
#   （报错 RPC failed; curl 52 Empty reply from server），此时 git push 推不上去，
#   用本脚本走 GitHub Contents API 逐文件上传兜底。
#
#  token 需要 repo 权限，且不要写进任何文件/文档里。
set -uo pipefail

OWNER="HANKpy"
REPO="short-drama-master-h5"
BRANCH="main"
API="https://api.github.com/repos/${OWNER}/${REPO}/contents"

FILES=(
  ".gitignore"
  "README.md"
  "HANDOFF.md"
  "index.html"
  "build.py"
  "_validate.js"
  "_e2e.js"
  "sync_github.sh"
  "css/style.css"
  "js/data.js"
  "js/templates.js"
  "js/app.js"
)

if [ -z "${GH_TOKEN:-}" ]; then
  echo "[错误] 请先设置环境变量 GH_TOKEN（需要 repo 权限的 PAT）"
  echo "       GH_TOKEN=xxxx ./sync_github.sh"
  exit 1
fi

b64encode() { base64 -w0 "$1" 2>/dev/null || base64 "$1" | tr -d '\n'; }

fail=0
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then echo "  [跳过] $f（不存在）"; continue; fi

  content="$(b64encode "$f")"

  # 文件已存在时要带上 sha 才能更新
  sha="$(curl -s -m 30 -H "Authorization: Bearer ${GH_TOKEN}" \
        "${API}/${f}?ref=${BRANCH}" | grep -o '"sha" *: *"[^"]*"' | head -1 | cut -d'"' -f4)"

  if [ -n "$sha" ]; then
    printf '{"message":"chore: sync %s","content":"%s","branch":"%s","sha":"%s"}' \
      "$f" "$content" "$BRANCH" "$sha" > /tmp/.sdm_payload.json
  else
    printf '{"message":"feat: add %s","content":"%s","branch":"%s"}' \
      "$f" "$content" "$BRANCH" > /tmp/.sdm_payload.json
  fi

  code="$(curl -s -m 180 -X PUT \
        -H "Authorization: Bearer ${GH_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "Content-Type: application/json" \
        -d @/tmp/.sdm_payload.json -o /dev/null -w "%{http_code}" \
        "${API}/${f}")"

  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    printf "  [OK] %-22s %8s bytes\n" "$f" "$(stat -c%s "$f" 2>/dev/null || wc -c < "$f")"
  else
    fail=$((fail + 1))
    printf "  [✗] %-22s HTTP %s\n" "$f" "$code"
  fi
done
rm -f /tmp/.sdm_payload.json

if [ "$fail" -eq 0 ]; then
  echo ""
  echo "[完成] 已同步到 https://github.com/${OWNER}/${REPO}"
else
  echo ""
  echo "[警告] 有 ${fail} 个文件同步失败"
  exit 1
fi

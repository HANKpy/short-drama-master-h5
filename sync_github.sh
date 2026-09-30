#!/usr/bin/env bash
# 把本地源码同步到 GitHub 仓库 HANKpy/short-drama-master-h5
#
# 用法：
#   GH_TOKEN=<你的 Personal Access Token> ./sync_github.sh
#
# 策略：
#   1) 优先 git push（快、保留真实提交历史）
#   2) git push 失败时自动回退到 GitHub Contents API 逐文件上传
#      ——某些代理环境会掐断 git 的大 POST（RPC failed; curl 52 Empty reply from server），
#        此时 API 上传仍然可用，所以保留这条兜底路径。
#
# token 需要 repo 权限，且不要写进任何文件/文档里。
set -uo pipefail

OWNER="HANKpy"
REPO="short-drama-master-h5"
BRANCH="main"
REMOTE="https://github.com/${OWNER}/${REPO}.git"
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
  "dist/short-drama-master-h5.html"
)

if [ -z "${GH_TOKEN:-}" ]; then
  echo "[错误] 请先设置环境变量 GH_TOKEN（需要 repo 权限的 PAT）"
  echo "       GH_TOKEN=xxxx ./sync_github.sh"
  exit 1
fi

echo "=== 1) 先尝试 git push ==="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # 远端可能有本地没有的提交（比如曾用 API 上传过），先接上历史再推
  git fetch -q origin "$BRANCH" 2>/dev/null
  if [ -n "$(git rev-parse --verify -q FETCH_HEAD)" ]; then
    GIT_EDITOR=true git rebase FETCH_HEAD >/dev/null 2>&1
  fi
  out="$(GIT_TERMINAL_PROMPT=0 git -c http.postBuffer=1048576000 \
        -c http.version=HTTP/1.1 -c http.lowSpeedLimit=0 \
        push "https://${OWNER}:${GH_TOKEN}@github.com/${OWNER}/${REPO}.git" "$BRANCH" 2>&1)"
  # 输出里可能带 token，统一掩码后再打印
  echo "$out" | sed "s/${GH_TOKEN}/[REDACTED]/g" | tail -3
  if echo "$out" | grep -qE "^ *[0-9a-f]+\.\.[0-9a-f]+|Everything up-to-date"; then
    echo ""
    echo "[完成] git push 成功 → https://github.com/${OWNER}/${REPO}"
    exit 0
  fi
  echo "[提示] git push 未成功，回退到 Contents API 逐文件上传"
else
  echo "[提示] 当前目录不是 git 仓库，直接走 Contents API"
fi

echo ""
echo "=== 2) Contents API 逐文件上传 ==="
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
    printf "  [OK] %-34s %8s bytes\n" "$f" "$(stat -c%s "$f" 2>/dev/null || wc -c < "$f")"
  else
    fail=$((fail + 1))
    printf "  [✗] %-34s HTTP %s\n" "$f" "$code"
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

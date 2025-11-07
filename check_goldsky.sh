#!/bin/bash

PORT=35681
STATUS_FILE="/tmp/subgraph_status.txt"
echo "Initializing..." > "$STATUS_FILE"

# 登录
echo "准备登录 Goldsky..."
goldsky login || { echo "登录失败"; exit 1; }
echo -e "\n登录成功，开始监控子图状态...\n"

# HTTP服务函数
start_http_service() {
    PIPE="/tmp/subgraph_http_pipe"
    rm -f "$PIPE"; mkfifo "$PIPE"
    
    while true; do
        {
            # 读取请求头
            while read -r line; do [[ "$line" == $'\r' || -z "$line" ]] && break; done
            
            # 读取最新状态（移除换行符）
            current_status=$(tr -d '\n' < "$STATUS_FILE")
            
            # 生成JSON响应
            echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
            echo "{"
            echo "  \"timestamp\": \"$(date '+%Y-%m-%d %H:%M:%S')\","
            echo "  \"status\": \"${current_status//\"/\\\"}\""  # 转义双引号
            echo "}"
        } < "$PIPE" | nc -l $PORT > "$PIPE"
    done
}

# 启动HTTP服务
start_http_service &
HTTP_PID=$!
trap 'kill $HTTP_PID; rm -f "$PIPE" "$STATUS_FILE"; exit' INT TERM

# 主监控循环
while true; do
    # 获取并处理状态（生成单行输出）
    new_status=$(goldsky subgraph list 2>&1 | awk '
    BEGIN { RS = "\\* "; FS = "\n"; output = "" }
    /^[^ ]/ {
        subgraph_name = substr($1, 14)
        for (i=2; i<=NF; i++) {
            if ($i ~ /Status:/) {
                split($i, parts, ": ")
                status = parts[2]
                gsub(/[ \t$$]+/, " ", status)
                sub("^ +| +$", "", status)
                
                # 构建字符串输出
                output = output "Subgraph: " subgraph_name " - Status: " status "; "
                break
            }
        }
    }
    END { print output }')
    
    # 更新状态文件（确保无换行）
    if [ -n "$new_status" ]; then
        echo "$new_status" > "$STATUS_FILE"
    else
        echo "No status available" > "$STATUS_FILE"
    fi
    
    echo "[$(date '+%H:%M:%S')] 当前状态: $(cat "$STATUS_FILE")"
    sleep 60
done
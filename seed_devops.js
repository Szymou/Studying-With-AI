module.exports = [
  // ============ Linux基础与命令 (1-7) ============
  [
    '运维DevOps综合',
    '种子题',
    'Linux中如何查看一个进程的CPU和内存占用？请列举至少三种命令并说明区别。',
    '使用 `top` 可实时查看所有进程的资源占用，按 `P` 按CPU排序、按 `M` 按内存排序。`ps aux --sort=-%cpu` 可一次性输出并按CPU降序排列。`htop` 是增强版交互工具，支持鼠标操作和树形视图。`pidstat -p PID 1` 可针对单个进程持续采样。\n\n```bash\n# 查看CPU占用最高的5个进程\nps aux --sort=-%cpu | head -6\n\n# 实时监控指定进程\ntop -p 1234\n```',
    'medium',
    'seed,devops,linux',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Linux文件权限 rwxr-xr-- 表示什么含义？如何递归修改目录权限？',
    '该权限表示：文件所有者可读可写可执行(7)，所属组可读可执行(5)，其他人只读(4)。第一个字符 `-` 表示普通文件，`d` 表示目录。目录的`x`权限决定能否进入该目录。\n\n递归修改时，文件通常设为644，目录设为755：\n\n```bash\n# 递归修改目录权限为755\nfind /path -type d -exec chmod 755 {} \\;\n# 或\nchmod 755 $(find /path -type d)\n\n# 递归修改文件权限为644\nfind /path -type f -exec chmod 644 {} \\;\n\n# 简单递归（会同时改文件和目录，不推荐）\nchmod -R 755 /path\n```\n\n**常见陷阱**：不要对文件设置`x`权限除非确实需要可执行；`chmod -R` 会无差别修改所有类型，建议分开处理文件和目录。',
    'medium',
    'seed,devops,linux',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何编写一个Systemd Service Unit文件？请给出一个Java应用的示例并说明关键配置项。',
    'Systemd unit 文件放在 `/etc/systemd/system/` 下，`.service` 后缀。关键配置项包括 `ExecStart`（启动命令）、`WorkingDirectory`（工作目录）、`User`（运行用户）、`Restart`（重启策略）、`Environment`（环境变量）。\n\n```ini\n[Unit]\nDescription=My Java Application\nAfter=network.target\n\n[Service]\nType=simple\nUser=appuser\nWorkingDirectory=/opt/myapp\nExecStart=/usr/bin/java -Xms512m -Xmx2g -jar app.jar --server.port=8080\nRestart=always\nRestartSec=10\nEnvironment=SPRING_PROFILES_ACTIVE=prod\nLimitNOFILE=65536\n\n[Install]\nWantedBy=multi-user.target\n```\n\n```bash\n# 重新加载并启动\nsystemctl daemon-reload\nsystemctl enable myapp.service\nsystemctl start myapp.service\nsystemctl status myapp.service\n```\n\n**最佳实践**：生产环境务必设置 `LimitNOFILE` 防止文件句柄耗尽；`Restart=always` 确保进程崩溃后自动拉起；使用 `journalctl -u myapp.service -f` 实时查看日志。',
    'medium',
    'seed,devops,linux,systemd',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Shell脚本中 `$?`、`$@`、`$*`、`$#`、`$$` 分别代表什么？如何安全处理脚本错误？',
    '`$?` 上一条命令的退出码(0成功，非0失败)；`$@` 所有参数（每个参数独立带引号，推荐使用）；`$*` 所有参数（合并为单个字符串）；`$#` 参数个数；`$$` 当前Shell进程PID。\n\n```bash\n#!/bin/bash\nset -euo pipefail  # 遇到错误退出、未定义变量报错、管道错误捕获\n\nerror_handler() {\n    echo \"[ERROR] 第 $1 行出错，退出码 $2\" >&2\n    exit 1\n}\ntrap \'error_handler $LINENO $?\' ERR\n\nif [ $# -eq 0 ]; then\n    echo \"Usage: $0 <param>\" >&2\n    exit 1\nfi\n\nfor arg in \"$@\"; do\n    echo \"Processing: $arg\"\ndone\n```\n\n**常见陷阱**：忘记`set -e`导致错误被忽略；`$@` 不用双引号包裹导致参数中包含空格时被拆分。',
    'medium',
    'seed,devops,linux,shell',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何使用 `netstat` 或 `ss` 排查端口占用和网络连接状态？请说明TIME_WAIT和CLOSE_WAIT的区别。',
    '`ss` 是 `netstat` 的现代替代品，性能更好。`ss -tuln` 查看所有监听端口，`ss -tan` 查看所有TCP连接状态。\n\n```bash\n# 查看端口8080是否被占用\nss -tuln | grep 8080\n# 或\nnetstat -tulnp | grep 8080\n\n# 统计各连接状态数量\nss -tan | awk \'{print $1}\' | sort | uniq -c\n\n# 查看具体进程占用\nss -tulnp | grep 8080\n```\n\n**TIME_WAIT**：主动关闭连接的一方在发送最后一个ACK后进入的状态，等待2MSL（约60s）后释放，确保对方收到ACK。大量TIME_WAIT会耗尽端口资源，可通过开启 `net.ipv4.tcp_tw_reuse` 缓解。\n\n**CLOSE_WAIT**：被动关闭方收到FIN后进入的状态，等待应用层调用close()。大量CLOSE_WAIT通常意味着应用程序有BUG——没有正确关闭连接。\n\n**最佳实践**：监控 `ss -tan | grep CLOSE_WAIT | wc -l`，超过阈值说明应用存在连接泄漏。',
    'medium',
    'seed,devops,linux,network',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Linux中如何排查磁盘IO瓶颈？请说明iostat和iotop的使用场景。',
    '`iostat -x 1` 查看磁盘的利用率(%util)、平均IO等待时间(await)、IOPS(r/s+w/s)。`iotop` 按进程实时显示IO读写速率，适合定位"哪个进程在大量写盘"。\n\n```bash\n# 查看磁盘IO统计，每秒刷新\niostat -x 1 5\n\n# 关键指标解读：\n# - %util 接近100% → 磁盘饱和\n# - await > 30ms → 磁盘响应慢\n# - svctm 远小于 await → 说明请求在排队\n\n# 按IO排序查看进程\niotop -oP  # 只显示有IO操作的进程\n```\n\n经验法则：%util 持续>90%且await较高时，需考虑升级磁盘(SSD)、增加缓存或优化SQL。如果r/s高但await正常，通常是缓存命中率不足。',
    'medium',
    'seed,devops,linux,performance',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Linux中 `/proc` 文件系统的作用是什么？如何通过它排查OOM Killer问题？',
    '`/proc` 是一个虚拟文件系统，暴露内核和进程的运行信息。当系统内存不足时，OOM Killer会选择并杀死一个进程来释放内存。\n\n```bash\n# 查看OOM Killer是否触发过\ndmesg | grep -i oom\n\n# 查看评分最高的进程（被杀的候选者）\nfor pid in $(ls /proc | grep -E \'^[0-9]+$\'); do\n    echo "PID: $pid, Score: $(cat /proc/$pid/oom_score 2>/dev/null), Adj: $(cat /proc/$pid/oom_score_adj 2>/dev/null), Cmd: $(cat /proc/$pid/cmdline 2>/dev/null | tr \'\\0\' \' \')" 2>/dev/null\ndone 2>/dev/null | sort -t: -k3 -rn | head -10\n\n# 查看系统内存分布\ncat /proc/meminfo\n\n# 查看进程内存映射\ncat /proc/PID/smaps | grep -E \'Pss|Name\'\n```\n\n**最佳实践**：关键服务设置 `oom_score_adj=-1000` 防止被误杀；配置swap时要谨慎，分配过量内存会导致OOM；生产环境建议设置 `vm.overcommit_memory=2` 禁止内存过量分配。',
    'medium',
    'seed,devops,linux,kernel',
    'devops'
  ],

  // ============ Docker容器 (8-14) ============
  [
    '运维DevOps综合',
    '种子题',
    '请编写一个Spring Boot应用的多阶段构建Dockerfile，并说明每阶段的作用。',
    '多阶段构建将编译环境和运行环境分离，最终镜像只包含运行所需的文件，大幅减小镜像体积。\n\n```dockerfile\n# 第一阶段：编译\nFROM maven:3.8-openjdk-11 AS builder\nWORKDIR /build\nCOPY pom.xml .\nRUN mvn dependency:go-offline  # 提前下载依赖，利用Docker缓存\nCOPY src ./src\nRUN mvn package -DskipTests -Dmaven.test.skip=true\n\n# 第二阶段：运行\nFROM openjdk:11-jre-slim\nWORKDIR /app\n# 从builder阶段复制产物\nCOPY --from=builder /build/target/*.jar app.jar\nEXPOSE 8080\nUSER 1000:1000  # 非root用户运行\nENV JAVA_OPTS="-Xms256m -Xmx512m"\nENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]\n```\n\n**最佳实践**：按依赖变化频率分层（pom.xml先复制→下载依赖→再复制源码），最大化缓存利用率；最终镜像使用 `jre-slim` 而非 `jdk`；必须使用非root用户。',
    'medium',
    'seed,devops,docker',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Docker容器中进程以root运行有什么风险？如何正确配置以非root用户运行？',
    '容器共享宿主机内核，若容器内进程以root运行且存在漏洞，攻击者可能通过内核漏洞逃逸到宿主机。即使有namespace隔离，某些操作（如挂载、capabilities）仍可能造成风险。\n\n```dockerfile\n# 方式一：Dockerfile中创建用户\nFROM alpine:3.18\nRUN addgroup -g 1000 -S appgroup && \\\n    adduser -u 1000 -S appuser -G appgroup\nUSER appuser\nCOPY --chown=appuser:appgroup app /app\nWORKDIR /app\nCMD ["./app"]\n\n# 方式二：运行时指定用户（覆盖Dockerfile中的USER）\ndocker run --user 1000:1000 myimage\n```\n\n```bash\n# 验证容器中运行的进程用户\ndocker exec CONTAINER_ID ps aux\n\n# 查看容器的Capabilities\ndocker inspect CONTAINER_ID | jq \'.[0].HostConfig.CapDrop\'\n```\n\n**最佳实践**：Dockerfile中始终设置 `USER`；`--cap-drop=ALL` 后按需添加特定capability；永远不要将Docker Socket挂载到容器中。',
    'medium',
    'seed,devops,docker,security',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Docker的网络模式有哪些？如何让两个容器互相通信？',
    'Docker主要有四种网络模式：\n- **bridge**（默认）：容器通过docker0网桥通信，需端口映射才能从宿主机访问\n- **host**：直接使用宿主机网络栈，无网络隔离\n- **none**：无网络，用于隔离场景\n- **overlay**：跨宿主机容器通信，用于Swarm或Kubernetes\n\n```bash\n# 创建自定义bridge网络（推荐）\ndocker network create --driver bridge --subnet 172.20.0.0/16 mynet\n\n# 容器加入同一网络即可通过容器名通信\ndocker run -d --name app1 --net mynet nginx\ndocker run -d --name app2 --net mynet alpine sh -c "ping app1"\n\n# 查看网络详情\ndocker network inspect mynet\n\n# 已有容器加入网络\ndocker network connect mynet existing_container\n```\n\n**最佳实践**：使用自定义bridge网络而非默认bridge，因为自定义网络支持自动DNS解析（容器名→IP）；生产环境使用docker-compose时默认会创建同名网络。',
    'medium',
    'seed,devops,docker,network',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Docker数据持久化有哪几种方式？Named Volume和Bind Mount有什么区别？',
    'Docker数据持久化有三种方式：**Bind Mount** 直接映射宿主机目录；**Named Volume** 由Docker管理的卷；**tmpfs mount** 临时存储在内存中。\n\n```yaml\n# docker-compose.yml 示例\nversion: \'3.8\'\nservices:\n  mysql:\n    image: mysql:8.0\n    volumes:\n      # Named Volume — Docker自动管理路径\n      - mysql_data:/var/lib/mysql\n      # Bind Mount — 直接映射宿主机路径\n      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro\n      # tmpfs — 临时文件，不持久化\n    tmpfs:\n      - /tmp\n\nvolumes:\n  mysql_data:  # 声明named volume\n```\n\n```bash\n# Named Volume 相关命令\ndocker volume create my_volume\ndocker volume ls\ndocker volume inspect my_volume  # 查看实际路径\n\n# Bind Mount 启动\ndocker run -v /host/path:/container/path nginx\n```\n\n**关键区别**：Bind Mount依赖宿主机目录结构，不可移植；Named Volume由Docker管理，跨主机迁移方便。Bind Mount适合开发时热重载，Named Volume适合生产环境数据库等有状态服务。\n\n**常见陷阱**：Bind Mount会覆盖容器内目标路径的所有内容；MySQL的init.d目录做bind mount时如果宿主机目录为空，初始化脚本不会执行。',
    'medium',
    'seed,devops,docker,storage',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'docker-compose中depends_on、healthcheck和restart如何配合实现服务依赖管理？',
    '`depends_on` 仅控制启动顺序，不等待服务就绪。需要配合 `healthcheck` 确保上游服务真正可用。`restart` 策略保证异常时自动恢复。\n\n```yaml\nversion: \'3.8\'\nservices:\n  db:\n    image: postgres:15\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 5s\n      timeout: 3s\n      retries: 5\n      start_period: 10s  # 启动期间不计数\n    restart: unless-stopped\n\n  app:\n    build: .\n    depends_on:\n      db:\n        condition: service_healthy  # 等待健康检查通过\n    restart: on-failure\n    ports:\n      - "8080:8080"\n```\n\n**最佳实践**：`start_period` 避免初始化慢导致误判；应用层也应实现重试连接逻辑（retry + backoff），因为即使健康检查通过，连接瞬间仍可能失败。',
    'medium',
    'seed,devops,docker,docker-compose',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何排查Docker容器内存/CPU使用过高的问题？请说明docker stats和docker inspect的用法。',
    '`docker stats` 实时查看所有容器的资源占用，`docker inspect` 查看容器的详细配置和资源限制。结合 `docker exec` 进入容器内部分析。\n\n```bash\n# 实时查看所有容器资源\ndocker stats --no-stream  # 一次性输出\ndocker stats  # 持续监控（Ctrl+C退出）\n\n# 查看容器资源限制和当前状态\ndocker inspect CONTAINER_ID | jq \'.[0].HostConfig.Memory\'\ndocker inspect CONTAINER_ID | jq \'.[0].HostConfig.NanoCpus\'\n\n# 进入容器内部排查\ndocker exec -it CONTAINER_ID sh\n# 容器内使用top/ps等命令\n\n# 查看容器日志中是否有OOM记录\ndocker logs --tail 100 CONTAINER_ID | grep -i oom\n```\n\n**常见陷阱**：未设置 `--memory` 限制时，单个容器可能耗尽宿主机全部内存；Java应用未设置JVM `-Xmx` 会导致JVM占用超过容器限制而被OOM Kill。`docker stats` 显示的内存是RSS而非JVM Heap。',
    'medium',
    'seed,devops,docker,troubleshooting',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Docker镜像层缓存机制的原理是什么？如何优化Dockerfile以最大化缓存命中？',
    'Docker镜像由只读层叠加而成，每一条RUN/COPY/ADD指令创建一个新层。构建时如果某层之前已存在且指令未变，直接使用缓存。但若某层缓存未命中（如COPY的文件有变化），之后所有层都会重新构建。\n\n```dockerfile\n# 不推荐（任何源码改动都会重新下载依赖）\nFROM node:18\nCOPY . /app\nWORKDIR /app\nRUN npm install\n\n# 优化写法（先COPY包管理文件，利用缓存）\nFROM node:18\nWORKDIR /app\nCOPY package.json yarn.lock ./\nRUN yarn install --frozen-lockfile\nCOPY . .\nRUN yarn build\n\nEXPOSE 3000\nCMD ["yarn", "start"]\n```\n\n**最佳实践**：按照变化频率从低到高排列指令；`.dockerignore` 排除 `node_modules`、`.git` 等非必要文件；多阶段构建时将builder阶段的依赖下载与编译分离。\n\n**注意**：`ADD` 指令会计算tar文件的checksum，即便内容相同也会导致缓存失效，优先用 `COPY`。',
    'medium',
    'seed,devops,docker,build',
    'devops'
  ],

  // ============ Kubernetes编排 (15-21) ============
  [
    '运维DevOps综合',
    '种子题',
    'Kubernetes中Pod的状态有哪些？如何排查Pod一直处于Pending/CrashLoopBackOff的问题？',
    'Pod状态包括：`Pending`（等待调度）、`Running`（正常运行）、`CrashLoopBackOff`（不断重启）、`ImagePullBackOff`（拉取镜像失败）、`Error`（启动报错）、`Completed`（一次性任务完成）。\n\n```bash\n# 查看Pod状态和事件\nkubectl describe pod POD_NAME -n NAMESPACE\n\n# 查看Pod日志\nkubectl logs --tail 100 POD_NAME\nkubectl logs --previous POD_NAME\n\n# 排查Pending的常见原因\nkubectl describe pod POD_NAME | grep -A10 Events\n# - 资源不足(Insufficient memory/cpu)\n# - 节点有污点(taint)而Pod无容忍度(toleration)\n# - PVC未就绪\n\n# 排查CrashLoopBackOff\nkubectl logs POD_NAME\n# - 应用配置错误（数据库连接串、环境变量等）\n# - 存活探针(livenessProbe)配置过于严格\n# - OOM（查看是否超过资源限制）\n```\n\n**最佳实践**：`kubectl describe` 比 `kubectl logs` 更有价值，因为Events字段包含了调度和拉取镜像的关键错误信息。',
    'medium',
    'seed,devops,kubernetes,pod',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Deployment的滚动更新策略如何配置？如何实现零停机更新？',
    'Deployment的 `strategy.type=RollingUpdate` 控制滚动更新行为。`maxSurge` 控制更新期间可以超出期望副本数的最大比例，`maxUnavailable` 控制最多可有多少副本不可用。\n\n```yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: myapp\nspec:\n  replicas: 3\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0\n  minReadySeconds: 5\n  template:\n    spec:\n      terminationGracePeriodSeconds: 60\n      containers:\n      - name: app\n        image: myapp:1.0.0\n        readinessProbe:\n          httpGet:\n            path: /actuator/health\n            port: 8080\n          initialDelaySeconds: 5\n          periodSeconds: 10\n```\n\n```bash\nkubectl set image deployment/myapp app=myapp:1.0.1\nkubectl rollout status deployment/myapp\nkubectl rollout undo deployment/myapp\n```\n\n**最佳实践**：生产环境设置 `maxUnavailable: 0` 保证更新期间不丢流量；配置 `preStop` hook 执行优雅关闭；readinessProbe 的阈值不要过于敏感。',
    'medium',
    'seed,devops,kubernetes,deployment',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Kubernetes Service有哪几种类型？ClusterIP、NodePort和LoadBalancer分别适用于什么场景？',
    '**ClusterIP**（默认）：在集群内部暴露Service，通过Cluster IP访问，适用于内部服务通信。**NodePort**：在每个节点端口上暴露服务，外部可通过 `NodeIP:NodePort` 访问，适合开发测试。**LoadBalancer**：使用云厂商LB暴露服务，生产环境首选。**Headless Service**（clusterIP=None）：直接返回Pod IP列表，适合StatefulSet。\n\n```yaml\napiVersion: v1\nkind: Service\nmetadata:\n  name: backend\nspec:\n  type: ClusterIP\n  selector:\n    app: backend\n  ports:\n  - port: 80\n    targetPort: 8080\n```\n\n**最佳实践**：生产环境使用Ingress暴露HTTP服务，后端服务用ClusterIP；NodePort仅用于调试或无LB环境；从NodePort迁移到LoadBalancer只需改 `type` 字段。',
    'medium',
    'seed,devops,kubernetes,service',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Kubernetes ConfigMap和Secret的使用场景是什么？如何将配置注入到Pod中？',
    'ConfigMap存储非敏感配置（数据库URL、日志级别等），Secret存储敏感信息（密码、TLS证书、API Key）。Secret在etcd中存储时会被base64编码，并支持自动加密。\n\n```yaml\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  application.yml: |\n    server:\n      port: 8080\n    logging:\n      level.root: INFO\n  DB_HOST: mysql-service\n---\napiVersion: v1\nkind: Secret\nmetadata:\n  name: db-secret\ntype: Opaque\ndata:\n  DB_PASSWORD: cGFzc3cwcmQ=\n---\napiVersion: apps/v1\nkind: Deployment\nspec:\n  template:\n    spec:\n      containers:\n      - name: app\n        env:\n          - name: DB_HOST\n            valueFrom:\n              configMapKeyRef:\n                name: app-config\n                key: DB_HOST\n          - name: DB_PASSWORD\n            valueFrom:\n              secretKeyRef:\n                name: db-secret\n                key: DB_PASSWORD\n```\n\n**最佳实践**：Secret用 `external-secrets` 或 `Sealed Secrets` 管理更安全；ConfigMap更新后Pod不会自动reload，需重启或使用 `reloader` 工具。',
    'medium',
    'seed,devops,kubernetes,configmap',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Kubernetes Ingress如何配置？如何实现基于域名的路由和HTTPS终止？',
    'Ingress将外部HTTP/HTTPS流量路由到集群内部Service。需要集群中部署Ingress Controller（如Nginx Ingress Controller、Traefik）。\n\n```yaml\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: myapp-ingress\n  annotations:\n    nginx.ingress.kubernetes.io/rewrite-target: /\nspec:\n  ingressClassName: nginx\n  tls:\n  - hosts:\n    - api.example.com\n    secretName: example-tls\n  rules:\n  - host: api.example.com\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: api-service\n            port:\n              number: 80\n```\n\n```bash\nkubectl create secret tls example-tls --cert=fullchain.pem --key=privkey.pem\n```\n\n**最佳实践**：使用cert-manager自动管理Let\'s Encrypt证书；通过annotation配置限流、CORS等高级功能。\n\n**常见陷阱**：Ingress规则中的域名没有对应的TLS Secret时，浏览器会报证书错误。',
    'medium',
    'seed,devops,kubernetes,ingress',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Kubernetes HPA（水平自动扩缩容）如何基于CPU/内存或自定义指标实现？',
    'HPA监控Pod的指标数据，根据目标值自动调整Deployment的副本数。支持CPU、内存和Prometheus自定义指标。\n\n```yaml\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: myapp-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: myapp\n  minReplicas: 2\n  maxReplicas: 10\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: 70\n  - type: Resource\n    resource:\n      name: memory\n      target:\n        type: Utilization\n        averageUtilization: 80\n```\n\n```bash\nkubectl get hpa -w\nkubectl describe hpa myapp-hpa\n```\n\n**最佳实践**：设置冷却时间防止频繁抖动；结合PodDisruptionBudget保证滚动更新时不中断业务；自定义指标需要部署Prometheus Adapter。\n\n**常见陷阱**：Java应用未设置JVM `-Xmx` 会导致容器内存使用率始终接近100%，触发持续扩容。',
    'medium',
    'seed,devops,kubernetes,hpa',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Kubernetes RBAC如何配置？如何创建只能查看某个命名空间资源的ServiceAccount？',
    'RBAC通过Role/ClusterRole定义权限，RoleBinding/ClusterRoleBinding将权限绑定到User/ServiceAccount/Group。\n\n```yaml\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  namespace: dev\n  name: pod-reader\nrules:\n- apiGroups: [""]\n  resources: ["pods", "pods/log", "services"]\n  verbs: ["get", "list", "watch"]\n---\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: dev-sa\n  namespace: dev\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: pod-reader-binding\n  namespace: dev\nsubjects:\n- kind: ServiceAccount\n  name: dev-sa\n  namespace: dev\nroleRef:\n  kind: Role\n  name: pod-reader\n  apiGroup: rbac.authorization.k8s.io\n```\n\n**最佳实践**：遵循最小权限原则，避免使用 `cluster-admin`；定期审计RBAC配置；不同环境使用不同的ServiceAccount。',
    'medium',
    'seed,devops,kubernetes,rbac',
    'devops'
  ],

  // ============ CI/CD流水线 (22-27) ============
  [
    '运维DevOps综合',
    '种子题',
    'GitLab CI中 `.gitlab-ci.yml` 的stages、jobs和artifacts如何配置？请给出一个Java项目的CI示例。',
    'GitLab CI按stages顺序执行，每个stage可包含多个并行job。artifacts用于在job之间传递文件（如编译产物）。\n\n```yaml\nstages:\n  - build\n  - test\n  - package\n  - deploy\n\nvariables:\n  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"\n\ncache:\n  key: ${CI_COMMIT_REF_SLUG}\n  paths:\n    - .m2/repository\n\nbuild-job:\n  stage: build\n  image: maven:3.8-openjdk-11\n  script:\n    - mvn compile -q\n  artifacts:\n    paths:\n      - target/classes/\n    expire_in: 1 hour\n\ntest-job:\n  stage: test\n  image: maven:3.8-openjdk-11\n  script:\n    - mvn test\n\ndeploy-staging:\n  stage: deploy\n  image: bitnami/kubectl:latest\n  script:\n    - kubectl set image deployment/myapp app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n  only:\n    - main\n```\n\n**最佳实践**：使用 `cache` 加速依赖下载；`artifacts` 设置 `expire_in` 避免存储膨胀；敏感变量通过CI/CD Settings的Variables配置。',
    'medium',
    'seed,devops,cicd,gitlab-ci',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Jenkins Pipeline中声明式Pipeline和脚本式Pipeline有什么区别？请给出一个声明式Pipeline示例。',
    '声明式Pipeline（Declarative）提供结构化语法，更易读和维护；脚本式Pipeline（Scripted）基于Groovy DSL，更灵活但复杂度高。生产环境推荐声明式。\n\n```groovy\npipeline {\n    agent any\n    tools {\n        maven \'Maven-3.8\'\n        jdk \'JDK-11\'\n    }\n    stages {\n        stage(\'Build\') {\n            steps {\n                sh \'mvn clean package\'\n            }\n        }\n        stage(\'Test\') {\n            steps {\n                sh \'mvn test\'\n            }\n        }\n    }\n    post {\n        failure {\n            emailext(\n                to: \'team@example.com\',\n                subject: "构建失败: ${env.JOB_NAME}",\n                body: "请查看 ${env.BUILD_URL}"\n            )\n        }\n    }\n}\n```\n\n**最佳实践**：使用 `when` 条件控制执行环境；`post` 块统一处理通知和清理；密码等敏感信息使用Jenkins Credentials Binding插件。',
    'medium',
    'seed,devops,cicd,jenkins',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'GitHub Actions中workflow、job和step的关系是什么？如何实现矩阵构建？',
    '**Workflow** 由一个或多个job组成，由事件触发（push、PR等）；**Job** 是一组step的集合，在同一runner中执行；**Step** 是单个操作（运行命令或使用action）。矩阵构建（matrix）可自动并行多个版本的构建任务。\n\n```yaml\nname: CI\non: [push, pull_request]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        java: [11, 17, 21]\n        os: [ubuntu-latest, windows-latest]\n      fail-fast: false\n    steps:\n    - uses: actions/checkout@v4\n    - name: Setup Java\n      uses: actions/setup-java@v3\n      with:\n        java-version: ${{ matrix.java }}\n        distribution: \'temurin\'\n    - name: Run Tests\n      run: mvn test -B\n```\n\n**最佳实践**：使用 `actions/cache` 加速依赖安装；`fail-fast: false` 确保矩阵中一个版本失败不会取消其他版本；多job时用 `needs` 控制依赖顺序。',
    'medium',
    'seed,devops,cicd,github-actions',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'CI/CD中制品（Artifact）管理的最佳实践是什么？如何管理Docker镜像的版本和标签？',
    '制品管理核心：唯一标识版本、设置保留策略、扫码扫描。Docker镜像标签策略推荐使用Git Commit SHA或SemVer，避免使用 `latest`。\n\n```bash\n# Docker镜像标签示例\ndocker build -t $REGISTRY/myapp:$CI_COMMIT_SHORT_SHA .\ndocker tag myapp:latest $REGISTRY/myapp:$CI_COMMIT_SHORT_SHA\ndocker push $REGISTRY/myapp:$CI_COMMIT_SHORT_SHA\n\n# 清理策略\ndocker image prune -a --filter "until=24h"\n```\n\n**最佳实践**：永远不要覆盖已发布的标签；`latest` 仅用于开发环境；结合 `cosign` 对镜像进行签名验证；设置制品保留策略防止存储爆炸。\n\n**常见陷阱**：使用 `latest` 导致部署时获取到非预期版本，生产环境难以回滚。',
    'medium',
    'seed,devops,cicd,artifact',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Pipeline as Code相比传统Jenkins界面配置有哪些优势？如何保证CI/CD配置的安全性？',
    'Pipeline as Code将CI/CD配置作为代码管理在Git仓库中，享受版本控制、代码审查、可追溯等好处。传统界面配置难以复现、不可审计。\n\n```yaml\n# GitLab CI — 不在yml中硬编码密钥\necho "$PRODUCTION_SSH_KEY" | base64 -d > ~/.ssh/id_rsa\n\n# GitHub Actions — 使用Secrets\n- name: Deploy\n  env:\n    API_KEY: ${{ secrets.API_KEY }}\n  run: deploy.sh\n\n# Jenkins — 使用Credentials Binding\nwithCredentials([\n    string(credentialsId: \'sonar-token\', variable: \'SONAR_TOKEN\')\n]) {\n    sh \'deploy.sh\'\n}\n```\n\n**最佳实践**：所有密钥通过平台Variables/Secrets管理；限制触发条件防止误操作；CI配置本身开启MR审查；定期轮换密钥。',
    'medium',
    'seed,devops,cicd,security',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何设计一套多环境（Dev/Staging/Prod）的CI/CD发布流程？如何控制不同环境的发布权限？',
    '多环境发布流程通常为：代码提交→自动构建→自动部署Dev→自动部署Staging→手动确认→部署Prod。不同环境通过环境名称和审批机制隔离。\n\n```yaml\ndeploy-dev:\n  stage: deploy\n  script:\n    - kubectl apply -f k8s/overlays/dev/\n  only:\n    - develop\n\ndeploy-production:\n  stage: deploy\n  script:\n    - kubectl apply -f k8s/overlays/prod/\n  when: manual\n  only:\n    - tags\n```\n\n**最佳实践**：使用Kustomize或Helm管理多环境差异配置；生产环境部署需要审批+变更窗口；每次部署自动记录变更日志。',
    'medium',
    'seed,devops,cicd,environments',
    'devops'
  ],

  // ============ 监控与日志 (28-34) ============
  [
    '运维DevOps综合',
    '种子题',
    'Prometheus的四种指标类型（Counter、Gauge、Histogram、Summary）分别适用于什么场景？',
    '**Counter**：只增不减的计数器，适合请求总量、错误总数。**Gauge**：可增可减，适合当前CPU使用率、内存用量、在线人数。**Histogram**：对观测值进行分桶统计，适合请求延迟P99/P95。**Summary**：类似Histogram但由客户端计算分位数，适合已知分位数需求。\n\n```yaml\n# Counter\nhttp_requests_total{method="GET", endpoint="/api"} 1024\n# Gauge\nnode_memory_MemAvailable_bytes 8388608000\n# Histogram P99查询\nhistogram_quantile(0.99, sum(rate(request_duration_seconds_bucket[5m])) by (le))\n```\n\n**最佳实践**：Counter用 `rate()` 计算每秒速率而非直接使用原始值；Histogram的buckets设置要覆盖预期范围；Summary不跨进程聚合，多实例用Histogram更合适。',
    'medium',
    'seed,devops,monitoring,prometheus',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何用Prometheus + Grafana监控JVM应用？需要暴露哪些关键指标？',
    'Spring Boot应用引入 `micrometer-registry-prometheus` 并暴露 `/actuator/prometheus` 端点，Prometheus定期拉取数据，Grafana配置Dashboard展示。\n\n```xml\n<dependency>\n    <groupId>io.micrometer</groupId>\n    <artifactId>micrometer-registry-prometheus</artifactId>\n</dependency>\n```\n\n```yaml\n# prometheus.yml\nscrape_configs:\n- job_name: \'spring-app\'\n  metrics_path: \'/actuator/prometheus\'\n  static_configs:\n  - targets: [\'localhost:8080\']\n```\n\n**关键指标**：`jvm_memory_used_bytes`、`jvm_gc_pause_seconds`（重点关注）、`http_server_requests_seconds`、`jvm_threads_live_threads`、`logback_events_total`。\n\n**最佳实践**：设置 `scrape_interval` 不要过于频繁（15s以上）；GC指标设置告警（Full GC > 1s）。',
    'medium',
    'seed,devops,monitoring,prometheus,grafana',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Prometheus告警规则如何编写？Alertmanager如何实现告警分组和路由？',
    '告警规则定义在Prometheus中，Alertmanager负责去重、分组、路由和发送通知。\n\n```yaml\ngroups:\n- name: node-alerts\n  rules:\n  - alert: HighCPUUsage\n    expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80\n    for: 5m\n    labels:\n      severity: warning\n    annotations:\n      summary: "{{ $labels.instance }} CPU使用率超过80%"\n```\n\n```yaml\n# alertmanager.yml\nroute:\n  receiver: \'default\'\n  group_by: [\'alertname\', \'severity\']\n  group_wait: 30s\n  repeat_interval: 4h\n  routes:\n  - receiver: \'pagerduty-critical\'\n    match:\n      severity: critical\n```\n\n**最佳实践**：`for` 字段防止瞬时抖动导致误报；`repeat_interval` 不要设置太短避免告警风暴。',
    'medium',
    'seed,devops,monitoring,alerting',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'ELK/EFK日志架构中Filebeat、Logstash和Elasticsearch各自的作用是什么？如何收集Kubernetes容器日志？',
    '**Filebeat**：轻量级日志采集器，资源消耗低。**Logstash**：日志处理管道，支持过滤、解析、转换。**Elasticsearch**：日志存储和搜索引擎。**Kibana**：可视化展示。\n\n```yaml\n# Filebeat DaemonSet采集容器日志\nfilebeat.inputs:\n- type: container\n  paths:\n    - /var/lib/docker/containers/*/*.log\n  processors:\n    - add_kubernetes_metadata:\n        host: ${NODE_NAME}\n\noutput.elasticsearch:\n  hosts: [\'elasticsearch:9200\']\n```\n\n**最佳实践**：K8s环境推荐EFK（用Fluent Bit替代Logstash，资源消耗更低）；配置日志轮转和索引生命周期管理（ILM）防止ES磁盘爆满。',
    'medium',
    'seed,devops,monitoring,elk',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '什么是SLI、SLO、SLA？如何设计合理的告警阈值？',
    '**SLI**：服务质量指标，如请求延迟P99、错误率、可用性。**SLO**：目标值，如"P99延迟 < 200ms，99.9%的时间"。**SLA**：对客户承诺的协议，通常比SLO宽松。\n\n```yaml\nslos:\n  availability:\n    target: 99.9%\n    window: 30天\n  latency:\n    sli: "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))"\n    target: "< 200ms"\n```\n\n**告警阈值设计原则**：使用「错误预算告警」而非固定阈值；多时间窗口组合避免瞬发抖动；分级告警。\n\n**常见陷阱**：固定阈值告警导致频繁误报（如CPU > 80%触发，实际业务无影响）。',
    'medium',
    'seed,devops,monitoring,slo',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Grafana如何配置多数据源和Dashboard变量？如何实现告警通知？',
    'Grafana支持Prometheus、Elasticsearch、InfluxDB、CloudWatch等多种数据源。Dashboard变量允许用户动态切换查询条件。\n\n```yaml\n# Contact Point\napiVersion: 1\ncontactPoints:\n  - name: webhook-alert\n    receivers:\n    - type: webhook\n      settings:\n        url: https://alertmanager.example.com/hook\n\npolicies:\n  - receiver: webhook-alert\n    group_by: [\'alertname\', \'severity\']\n    group_wait: 30s\n```\n\n**最佳实践**：使用变量实现多环境共用一个Dashboard；告警在Grafana 8+中可直接配置，无需额外Alertmanager。',
    'medium',
    'seed,devops,monitoring,grafana',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '什么是Blackbox Exporter和Node Exporter？它们分别用于监控什么？',
    '**Node Exporter**：部署在每个节点上，采集操作系统层面的指标（CPU、内存、磁盘、网络等），是主机监控的基础。**Blackbox Exporter**：对目标端点进行主动探测（HTTP、HTTPS、TCP、ICMP），模拟用户视角检查服务可达性。\n\n```yaml\n# Blackbox Exporter 配置\nmodules:\n  http_2xx:\n    prober: http\n    http:\n      valid_status_codes: [200, 301, 302]\n\n# Prometheus 抓取配置\nscrape_configs:\n- job_name: \'blackbox\'\n  metrics_path: /probe\n  params:\n    module: [http_2xx]\n  static_configs:\n  - targets:\n    - https://api.example.com\n  relabel_configs:\n  - source_labels: [__address__]\n    target_label: __param_target\n  - source_labels: [__param_target]\n    target_label: instance\n  - target_label: __address__\n    replacement: blackbox-exporter:9115\n```\n\n**最佳实践**：Node Exporter配合 `textfile` 收集自定义指标；Blackbox从多个地理位置探测更能反映真实可用性。',
    'medium',
    'seed,devops,monitoring,exporter',
    'devops'
  ],

  // ============ 网络协议基础 (35-40) ============
  [
    '运维DevOps综合',
    '种子题',
    'TCP三次握手和四次挥手的完整过程是什么？在排查网络问题时如何查看这些状态？',
    '**三次握手**：① 客户端发送SYN包；② 服务端回复SYN+ACK；③ 客户端发送ACK。\n**四次挥手**：① 主动方发送FIN；② 被动方回复ACK；③ 被动方发送FIN；④ 主动方回复ACK后进入TIME_WAIT。\n\n```bash\n# 查看当前连接状态\nss -tan | awk \'{print $1}\' | sort | uniq -c\n# 输出：ESTAB、TIME_WAIT、CLOSE_WAIT、SYN_SENT等\n```\n\n**排查要点**：大量 `SYN_RECV` 可能是SYN Flood攻击；大量 `TIME_WAIT` 正常但过多会耗尽端口；`CLOSE_WAIT` 异常增多说明应用未正确关闭连接。',
    'medium',
    'seed,devops,network,tcp',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'DNS解析的完整流程是什么？如何排查DNS解析延迟或失败的问题？',
    'DNS解析流程：浏览器缓存 → 操作系统缓存 → hosts文件 → 本地DNS服务器（递归查询） → 根DNS → 顶级域DNS → 权威DNS。\n\n```bash\n# DNS排查工具\ndig +trace api.example.com  # 跟踪完整解析路径\nnslookup api.example.com\ncat /etc/resolv.conf\n```\n\n**最佳实践**：配置多个DNS服务器（如 `nameserver 8.8.8.8` 和 `nameserver 114.114.114.114`）；K8s中CoreDNS的缓存配置可减少DNS查询压力。\n\n**常见陷阱**：DNS缓存污染导致解析到错误IP；TTL设置过短导致DNS查询频繁。',
    'medium',
    'seed,devops,network,dns',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'HTTP/1.1、HTTP/2和HTTP/3的核心区别是什么？对Web性能有什么影响？',
    '**HTTP/1.1**：文本协议，队头阻塞，每个连接只能串行请求。**HTTP/2**：二进制分帧、多路复用、头部压缩、服务端推送，解决了应用层队头阻塞。**HTTP/3**：基于QUIC（UDP），彻底解决TCP队头阻塞，0-RTT连接建立。\n\n```bash\n# 检查网站支持的HTTP版本\ncurl -I --http2 https://example.com\n```\n\n**升级建议**：服务端启用HTTP/2只需改TLS配置；CDN普遍支持HTTP/3可直接受益；HTTP/2必须使用TLS。',
    'medium',
    'seed,devops,network,http',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '负载均衡的常见算法有哪些？四层负载均衡和七层负载均衡有什么区别？',
    '**常见算法**：轮询、最少连接、IP哈希、加权轮询、一致性哈希。\n\n**四层负载均衡**（LVS、HAProxy的TCP模式）：基于IP+端口转发，性能高。\n**七层负载均衡**（Nginx、HAProxy的HTTP模式）：解析HTTP/HTTPS协议，可根据URL、Header等路由，功能丰富。\n\n```nginx\nupstream backend {\n    least_conn;\n    server 10.0.0.1:8080 weight=3;\n    server 10.0.0.2:8080 weight=1;\n    server 10.0.0.3:8080 backup;\n}\n```\n\n**选型建议**：高性能场景（MySQL、Redis代理）用四层；需要内容路由（API Gateway）用七层。',
    'medium',
    'seed,devops,network,loadbalancing',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '正向代理和反向代理的区别是什么？Nginx作为反向代理的常见配置有哪些？',
    '**正向代理**：代理客户端，隐藏客户端IP。**反向代理**：代理服务端，隐藏后端服务器，用于负载均衡、SSL终止、缓存。\n\n```nginx\nserver {\n    listen 443 ssl http2;\n    server_name api.example.com;\n\n    ssl_certificate /etc/nginx/certs/fullchain.pem;\n    ssl_certificate_key /etc/nginx/certs/privkey.pem;\n\n    location /api/ {\n        proxy_pass http://backend:8080/;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\n        proxy_connect_timeout 10s;\n        proxy_read_timeout 30s;\n    }\n}\n```\n\n**最佳实践**：设置合理的 `proxy_read_timeout` 防止连接泄漏；加 `X-Forwarded-*` 头让后端获取真实客户端信息。',
    'medium',
    'seed,devops,network,nginx,proxy',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'HTTPS/SSL/TLS握手过程是怎样的？如何配置A+评分的SSL？',
    'TLS 1.2握手：① Client Hello；② Server Hello + 证书；③ 客户端验证证书并生成Pre-master Secret；④ 生成会话密钥；⑤ Finished确认。TLS 1.3减少到1-RTT。\n\n```nginx\nserver {\n    listen 443 ssl http2;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;\n    ssl_prefer_server_ciphers off;\n    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;\n    ssl_stapling on;\n    ssl_stapling_verify on;\n}\n```\n\n**最佳实践**：禁用TLS 1.0/1.1；启用HSTS；启用OCSP Stapling；使用ECDSA证书比RSA更高效。',
    'medium',
    'seed,devops,network,tls,ssl',
    'devops'
  ],

  // ============ 安全与认证 (41-46) ============
  [
    '运维DevOps综合',
    '种子题',
    'SSL/TLS证书如何申请和管理？Let\'s Encrypt配合cert-manager在Kubernetes中如何自动续期？',
    'Let\'s Encrypt是免费的ACME协议CA，cert-manager是K8s中自动管理证书的Operator。它通过Issuer/ClusterIssuer配置证书颁发策略，自动申请和续期。\n\n```yaml\napiVersion: cert-manager.io/v1\nkind: ClusterIssuer\nmetadata:\n  name: letsencrypt-prod\nspec:\n  acme:\n    server: https://acme-v02.api.letsencrypt.org/directory\n    email: admin@example.com\n    privateKeySecretRef:\n      name: letsencrypt-account-key\n    solvers:\n    - http01:\n        ingress:\n          class: nginx\n```\n\n**最佳实践**：设置告警监控证书到期时间；使用 `staging` 环境测试后再切到 `prod`。',
    'medium',
    'seed,devops,security,tls,certificate',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'OAuth2.0的四种授权模式分别适用于什么场景？JWT和OAuth2.0是什么关系？',
    '**授权码模式**：适用于有后端的Web应用，安全性最高。**简化模式**：用于SPA（已淘汰，改用PKCE）。**密码模式**：仅限信任的第一方应用。**客户端凭证模式**：服务间通信。\n\n**JWT和OAuth2的关系**：OAuth2是授权框架，JWT是Token的格式。OAuth2可以用JWT（推荐）也可以用不透明的字符串作为Token。\n\n**最佳实践**：SPA使用授权码+PKCE模式；API认证用JWT但设置短过期时间（15-30分钟）；配合Refresh Token实现无感刷新。',
    'medium',
    'seed,devops,security,oauth2,jwt',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'JWT的结构是什么？如何安全地存储和校验JWT？',
    'JWT由三部分组成用`.`分隔：**Header**（算法类型）、**Payload**（声明）、**Signature**（签名防篡改）。Payload仅Base64编码并非加密，不能存放敏感信息。\n\n```javascript\n// Header\n{\n  "alg": "RS256",\n  "typ": "JWT"\n}\n// Payload\n{\n  "sub": "user_12345",\n  "name": "张三",\n  "iat": 1516239022,\n  "exp": 1516242622\n}\n```\n\n**安全最佳实践**：使用RS256而非HS256；设置合理的 `exp` 和 `iat`；前端存储在httpOnly Cookie中而非localStorage（防XSS）；实现Token黑名单机制。',
    'medium',
    'seed,devops,security,jwt',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Linux iptables防火墙如何配置？如何基于IP和端口做访问控制？',
    'iptables通过链和规则控制流量。INPUT链控制入站，OUTPUT链控制出站，FORWARD链控制转发。\n\n```bash\n# 基础安全策略\niptables -P INPUT DROP\niptables -P FORWARD DROP\niptables -P OUTPUT ACCEPT\n\niptables -A INPUT -i lo -j ACCEPT\niptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT\niptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT\niptables -A INPUT -p tcp --dport 80 -j ACCEPT\niptables -A INPUT -p tcp --dport 443 -j ACCEPT\n\n# 保存规则\niptables-save > /etc/iptables/rules.v4\n```\n\n**最佳实践**：配置前先添加cron任务定时恢复规则；建议使用 `ufw` 或 `firewalld` 简化管理。\n\n**常见陷阱**：忘记允许 `ESTABLISHED,RELATED` 导致回包被丢弃。',
    'medium',
    'seed,devops,security,firewall,iptables',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何管理敏感信息（数据库密码、API密钥）？HashiCorp Vault的基本用法是什么？',
    '敏感信息管理原则：不存储在代码中、加密传输和存储、定期轮换、审计访问记录。Vault提供统一的密钥管理和动态密钥生成。\n\n```bash\n# Vault基本操作\ndocker run -d --cap-add=IPC_LOCK -p 8200:8200 vault server -dev\nexport VAULT_ADDR=\'http://127.0.0.1:8200\'\nexport VAULT_TOKEN=\'root-token\'\nvault kv put secret/db/production username=db_admin password=\'SuperSecurePass\'\nvault kv get secret/db/production\n```\n\n```yaml\n# External Secrets Operator集成Vault\napiVersion: external-secrets.io/v1beta1\nkind: ExternalSecret\nmetadata:\n  name: db-secret\nspec:\n  secretStoreRef:\n    name: vault-backend\n    kind: SecretStore\n  target:\n    name: db-credentials\n  data:\n  - secretKey: DB_PASSWORD\n    remoteRef:\n      key: secret/db/production\n      property: password\n```\n\n**最佳实践**：使用动态密钥（临时凭证）替代静态密钥；Vault开启审计日志。',
    'medium',
    'seed,devops,security,vault,secrets',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何对Docker镜像进行漏洞扫描？有哪些常见的安全基线检查工具？',
    'Docker镜像漏洞扫描工具包括：**Trivy**（开源，快速全面）、**Clair**、**docker scan**（基于Snyk）。安全基线检查工具有：**kube-bench**（CIS K8s基准）、**kube-hunter**（渗透测试）。\n\n```bash\n# Trivy扫描镜像\ndocker run --rm aquasec/trivy image myapp:1.0.0\n\n# kube-bench (CIS Benchmark)\ndocker run --rm -v /etc:/etc:ro -v /var:/var:ro aquasec/kube-bench:latest\n```\n\n```yaml\n# GitLab CI集成Trivy\ntrivy-scan:\n  stage: security\n  image: aquasec/trivy:latest\n  script:\n    - trivy image --exit-code 1 --severity CRITICAL,HIGH $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n```\n\n**最佳实践**：CI/CD流水线中集成Trivy扫描，严重漏洞阻断构建；每月执行一次kube-bench检查。',
    'medium',
    'seed,devops,security,vulnerability-scanning',
    'devops'
  ],

  // ============ 自动化运维 (47-50) ============
  [
    '运维DevOps综合',
    '种子题',
    'Terraform的核心概念（Provider、Resource、State）是什么？如何管理远程状态？',
    '**Provider**：与基础设施提供商交互的插件。**Resource**：基础设施组件的声明式定义。**State**：Terraform维护的状态映射文件，记录资源ID和元数据。\n\n```hcl\nterraform {\n  backend "s3" {\n    bucket         = "my-terraform-state"\n    key            = "prod/terraform.tfstate"\n    region         = "ap-northeast-1"\n    dynamodb_table = "terraform-state-lock"\n    encrypt        = true\n  }\n}\n\nresource "aws_vpc" "main" {\n  cidr_block = "10.0.0.0/16"\n}\n```\n\n```bash\nterraform init\ndocker plan\nterraform apply -auto-approve\n```\n\n**最佳实践**：State文件必须远程存储 + 锁定；不同环境用不同State文件。',
    'medium',
    'seed,devops,terraform,iac',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Ansible的Playbook、Inventory和Role分别是什么？如何编写一个部署Java应用的Playbook？',
    '**Inventory**：定义受管主机列表。**Playbook**：YAML格式的任务编排。**Role**：模块化和可复用组织方式。\n\n```yaml\n# site.yml\n- name: Deploy Java Application\n  hosts: web\n  become: yes\n  tasks:\n    - name: 复制JAR包\n      copy:\n        src: "myapp.jar"\n        dest: "/opt/myapp/myapp.jar"\n        owner: appuser\n        group: appuser\n        mode: 0644\n      notify: restart app\n\n    - name: 启动服务\n      systemd:\n        name: myapp\n        state: started\n        enabled: yes\n\n  handlers:\n    - name: restart app\n      systemd:\n        name: myapp\n        state: restarted\n```\n\n```bash\nansible-playbook -i inventory.yml site.yml --check\n```\n\n**最佳实践**：使用 `--check` 和 `--diff` 预览变更；敏感信息用Ansible Vault加密。',
    'medium',
    'seed,devops,ansible,iac',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    'Infrastructure as Code（IaC）的核心原则是什么？Terraform和Ansible在设计理念上有何不同？',
    'IaC核心原则：**声明式/幂等性**、**版本控制**、**可复现**、**自文档化**、**不可变基础设施**。\n\n| 维度 | Terraform | Ansible |\n|------|-----------|---------|\n| 类型 | 声明式 | 过程式/声明式混合 |\n| 状态管理 | 有状态（state文件） | 无状态 |\n| 主要场景 | 基础设施生命周期管理 | 配置管理和应用部署 |\n| 幂等性 | 天然幂等 | 需确保每个模块幂等 |\n\n**最佳实践**：Terraform管理基础设施（云资源、DNS、VPC），Ansible管理配置（软件安装、文件分发），两者互补使用。',
    'medium',
    'seed,devops,iac,terraform,ansible',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '如何设计一套自动化配置管理系统？以管理100台Nginx服务器为例说明。',
    '设计思路：Inventory分组管理、配置模板化、自动化部署和验证、变更审批。\n\n```yaml\n# deploy-nginx.yml\n- name: 批量部署Nginx配置\n  hosts: nginx_prod\n  become: yes\n  serial: 2\n  tasks:\n    - name: 检查配置语法\n      shell: nginx -t\n      changed_when: false\n    - name: 重新加载Nginx\n      service:\n        name: nginx\n        state: reloaded\n```\n\n```bash\nansible-playbook -i inventory.yml deploy-nginx.yml --limit nginx_prod --check\n```\n\n**最佳实践**：`serial: 2` 滚动更新防止全部同时重启导致服务中断；配置变更前用 `nginx -t` 校验语法。',
    'medium',
    'seed,devops,automation,config-management',
    'devops'
  ],
  [
    '运维DevOps综合',
    '种子题',
    '容器化环境下如何实现配置热更新而不重启Pod？Kubernetes中有哪些常见方案？',
    '三种方案：1. **ConfigMap挂载为卷**：K8s同步更新文件，应用需监听文件变化。2. **Reloader工具**：监控ConfigMap变化，自动触发滚动更新。3. **Sidecar重载**：Sidecar监听配置变化后执行reload。\n\n```yaml\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  application.yml: |\n    logging:\n      level:\n        com.example: DEBUG\n---\napiVersion: apps/v1\nkind: Deployment\nspec:\n  template:\n    spec:\n      containers:\n      - name: app\n        volumeMounts:\n        - name: config\n          mountPath: /app/config\n      volumes:\n      - name: config\n        configMap:\n          name: app-config\n          defaultMode: 0444\n```\n\n**最佳实践**：首选Reloader方案；若应用支持文件监听则使用挂载方式。\n\n**常见陷阱**：ConfigMap更新到Pod挂载文件有延迟（约60秒）。',
    'medium',
    'seed,devops,kubernetes,hot-reload',
    'devops'
  ]
];
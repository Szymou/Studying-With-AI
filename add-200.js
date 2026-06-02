const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'questions.db');
const db = new sqlite3.Database(dbPath);

const newQuestions = [
    // Java基础 (8题)
    ['Java基础', '语法', 'transient关键字的作用？', 'transient修饰的变量不参与序列化。当对象被序列化时，transient字段的值被忽略，反序列化后恢复为默认值。'],
    ['Java基础', '语法', 'instanceof和isInstance的区别？', 'instanceof是运算符（obj instanceof Class）；isInstance是Class的方法（Class.isInstance(obj)），运行时动态判断。'],
    ['Java基础', '语法', 'java是编译型还是解释型？', 'Java是编译+解释混合型。源代码编译为字节码（.class），JVM解释执行字节码，热点代码通过JIT编译为机器码。'],
    ['Java基础', '语法', 'break和continue的区别？', 'break直接结束整个循环；continue跳过本次循环剩余语句，进入下一次迭代。'],
    ['Java基础', '语法', '静态代理和动态代理的区别？', '静态代理在编译期确定代理类；动态代理在运行时动态创建代理类（JDK Proxy基于接口，CGLIB基于类）。'],
    ['Java基础', '语法', 'Math.round(-1.5)的结果？', '-1。Math.round四舍五入，负数时向绝对值大的方向取整，即-1.5 -> -1。'],
    ['Java基础', '语法', '参数传递：可变参数是什么？', '可变参数（Varargs）允许方法接受可变数量的参数，语法为Type... param，底层是数组。'],
    ['Java基础', '语法', 'try-with-resources是什么？', 'Java7引入的自动资源管理，实现了AutoCloseable的资源会在try块结束后自动关闭，无需finally。'],
    
    // 集合 (5题)
    ['集合', 'List', 'Arrays和Collections的区别？', 'Arrays是数组工具类（排序、搜索、转List）；Collections是集合工具类（排序、同步、不可变）。'],
    ['集合', 'Map', 'HashMap的hash函数实现？', 'key的hashCode()高16位和低16位异或（h ^ (h >>> 16)），让高位参与哈希计算，减少冲突。'],
    ['集合', 'Map', 'WeakHashMap的原理？', '基于弱引用（WeakReference），当key不再被强引用时，GC时自动移除entry。用于缓存场景。'],
    ['集合', 'Queue', 'PriorityQueue的原理？', '基于二叉堆（小顶堆），默认自然排序或自定义Comparator。插入、删除O(logN)。'],
    ['集合', 'List', 'Collections.synchronizedList的原理？', '使用装饰器模式，在每个方法上添加synchronized块。与CopyOnWriteArrayList对比：读写都加锁。'],
    
    // 并发 (6题)
    ['并发', '锁', '自旋锁和适应性自旋锁？', '自旋锁：循环等待锁释放，避免上下文切换。适应性自旋锁：JVM根据上次自旋结果动态调整自旋次数。'],
    ['并发', '锁', '锁粗化和锁消除？', '锁粗化：合并连续加锁解锁；锁消除：JIT发现无共享竞争时去掉同步。'],
    ['并发', '线程', '守护线程是什么？', 'setDaemon(true)设置的线程，当所有用户线程结束后自动退出。GC线程是守护线程。'],
    ['并发', '线程', 'Thread.yield()的作用？', '让出CPU执行权，从运行态转为就绪态，但仍会参与下次CPU竞争。'],
    ['并发', '线程', '线程优先级有几种？', 'Java线程优先级范围1-10，默认5。但不同操作系统映射不同，不保证按优先级调度。'],
    ['并发', '锁', 'synchronized的底层实现？', '基于Monitor对象（ObjectMonitor），使用monitorenter和monitorexit字节码指令。'],
    
    // JVM (5题)
    ['JVM', '内存', '对象的内存布局？', '对象头（Mark Word + 类型指针）、实例数据、对齐填充。数组对象还包含数组长度。'],
    ['JVM', '调优', '什么是内存泄漏？常见原因？', '对象无法被GC回收但不再使用。常见：ThreadLocal未remove()、集合静态引用、未关闭资源。'],
    ['JVM', 'GC', '对象什么时候进入老年代？', '年龄达到阈值（默认15）、大对象直接进入老年代（-XX:PretenureSizeThreshold）、动态年龄判断。'],
    ['JVM', 'GC', 'CMS回收器的阶段？', '初始标记（STW）-> 并发标记 -> 重新标记（STW）-> 并发清除。优点是低延迟，缺点是浮动垃圾。'],
    ['JVM', '工具', 'OOM时如何获取堆转储？', '-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=指定路径。或使用jmap -dump:format=b,file=heap.hprof。'],
    
    // 框架 (6题)
    ['框架', 'Spring', '@Autowired和@Resource的区别？', '@Autowired按类型注入（Spring）；@Resource按名称注入（JSR-250），名称不可用时回退到类型。'],
    ['框架', 'Spring', '@Transactional是JDK代理还是CGLIB？', '默认，实现接口时JDK代理，未实现接口时CGLIB。@EnableTransactionManagement支持proxyTargetClass。'],
    ['框架', 'Spring', 'Spring BeanFactory和ApplicationContext的区别？', 'BeanFactory：延迟加载基础容器；ApplicationContext：预加载+更多功能（AOP、事件、国际化）。'],
    ['框架', 'Spring Boot', '@SpringBootApplication包含哪些注解？', '@SpringBootConfiguration（@Configuration）、@EnableAutoConfiguration、@ComponentScan。'],
    ['框架', 'MyBatis', 'MyBatis缓存机制？', '一级缓存（SqlSession级别，默认开启）；二级缓存（namespace级别，需配置<cache/>）。'],
    ['框架', 'MyBatis', 'MyBatis和Hibernate的区别？', 'MyBatis半自动（手写SQL，优化空间大）；Hibernate全自动（ORM映射，学习成本高）。'],
    
    // 设计模式 (3题)
    ['设计模式', '创建型', '建造者模式的应用？', '分离复杂对象的构建与表示。如StringBuilder、Lombok @Builder、OkHttp Request.Builder。'],
    ['设计模式', '结构型', '桥接模式的应用？', '将抽象与实现分离，独立变化。如JDBC Driver（Connection + Driver）。'],
    ['设计模式', '行为型', '责任链模式的应用？', '请求沿链传递，直到处理。如Servlet Filter、Spring拦截器、Netty Pipeline。'],
    
    // 网络编程 (3题)
    ['网络编程', 'HTTP', 'HTTP1.0、1.1、2.0的区别？', '1.0短连接；1.1持久连接（Keep-Alive）、管道化、Host头；2.0多路复用、服务器推送、二进制分帧。'],
    ['网络编程', 'HTTP', 'GET和POST的区别？', 'GET幂等，参数在URL（长度限制）；POST非幂等，参数在body。GET可缓存，POST默认不缓存。'],
    ['网络编程', '协议', 'DNS解析过程？', '递归查询：浏览器缓存 -> 系统hosts -> 本地DNS服务器 -> 根/顶级/权威服务器。'],
    
    // 数据库 (5题)
    ['数据库', 'MySQL', 'B树和B+树的区别？', 'B树每个节点存key+value；B+树内节点只存key，叶子节点存value+链表。B+树范围查询更快。'],
    ['数据库', 'MySQL', 'SQL连接方式？', 'INNER JOIN（内连接）、LEFT/RIGHT JOIN（外连接）、CROSS JOIN（笛卡尔积）。'],
    ['数据库', 'MySQL', 'char和varchar的区别？', 'char定长（0-255），不足补充空格；varchar变长（0-65535），额外1-2字节存储长度。char效率高。'],
    ['数据库', '索引', '联合索引的最左前缀原则？', '索引(a,b,c)，查询条件使用(a)、(a,b)、(a,b,c)时走索引；(b,c)不走索引。'],
    ['数据库', 'Redis', 'Redis过期策略？', '定时删除（惰性+定期）。定期扫描：默认每秒10次，每次抽查20个key，删除过期key，超时25%则继续。'],
    
    // Java 8+ (3题)
    ['Java 8+', 'Stream', 'parallelStream的原理？', '基于ForkJoinPool（默认线程数=CPU核心数），使用流的分支合并。注意线程安全。'],
    ['Java 8+', '函数式', 'Java8内置的函数式接口？', 'Consumer（消费）、Function（转换）、Predicate（判断）、Supplier（供给）。'],
    ['Java 8+', 'Stream', 'reduce和collect的区别？', 'reduce：归约为单个值；collect：可变累加（到集合/StringBuilder等）。'],
    
    // 微服务 (3题)
    ['微服务', 'Spring Cloud', 'Feign和OpenFeign的区别？', 'Feign（Netflix，已停更）；OpenFeign（Spring Cloud，支持Spring MVC注解/负载均衡/断路器）。'],
    ['微服务', '网关', 'Gateway和Zuul的区别？', 'Gateway基于WebFlux（非阻塞）；Zuul基于Servlet（阻塞）。Gateway是Spring官方推荐。'],
    ['微服务', '配置', '配置中心对比？', 'Nacos（AP+CP，管理面板友好）；Apollo（实时推送、灰度发布）；Consul（健康检查+KV）。'],
    
    // 消息队列 (3题)
    ['消息队列', 'RocketMQ', 'RocketMQ的架构组件？', 'Producer、Consumer、NameServer（路由）、Broker（存储）。Broker分为Master/Slave。'],
    ['消息队列', 'RabbitMQ', 'RabbitMQ如何保证消息可靠？', '生产者confirm + 消息持久化 + 消费者ack + 镜像队列。'],
    ['消息队列', 'Kafka', 'Kafka的ISR机制？', 'Leader维护ISR（In-Sync Replicas）集合，只有ISR中的副本才能晋升为Leader。'],
    
    // Git (5题)
    ['Git', '基础', 'rebase和merge的区别？', 'merge保留完整历史（推荐公共分支）；rebase线性历史（推荐个人分支），但仍需小心。'],
    ['Git', '基础', 'git reset和git revert的区别？', 'reset：移动HEAD，丢弃提交；revert：创建新提交撤销变更，安全用于公共分支。'],
    ['Git', '基础', '什么是冲突？如何解决？', '不同分支修改同一文件同一区域时产生冲突。手动编辑冲突标记后git add/commit。'],
    ['Git', '基础', 'git stash的作用？', '临时存储工作区和暂存区的修改。git stash pop恢复，git stash list查看。'],
    ['Git', '基础', 'git fetch和git pull的区别？', 'fetch只下载远程数据不合并；pull=fetch+merge。建议先fetch看差异再merge。'],
    
    // Linux (5题)
    ['Linux', '命令', '如何查看进程端口？', 'lsof -i:端口号、netstat -tlnp、ss -tlnp。'],
    ['Linux', '命令', 'chmod 755的含义？', 'rwxr-xr-x（所有者读写执行，同组读执行，其他人读执行）。7=rwx，5=r-x。'],
    ['Linux', '命令', '常用日志查看命令？', 'tail -f（实时跟踪）、less（翻页）、grep（搜索）、awk/sed（处理）。'],
    ['Linux', '命令', '软链接和硬链接的区别？', '软链接（ln -s）指向路径，可跨文件系统；硬链接（ln）指向inode，不可跨文件系统。'],
    ['Linux', '命令', '如何查找大文件？', 'find / -type f -size +100M，du -sh * | sort -rh。'],
    
    // Docker/K8s (5题)
    ['Docker', '基础', 'Docker镜像和容器的区别？', '镜像是只读模板，容器是运行时实例。镜像构建后不可变，容器可读写。'],
    ['Docker', '基础', 'Docker常用命令？', 'docker build/pull/run/ps/exec/logs/images/rmi/rm。'],
    ['Docker', '基础', 'Dockerfile中CMD和ENTRYPOINT的区别？', 'CMD提供默认命令（可被覆盖）；ENTRYPOINT固定入口命令。可配合使用：ENTRYPOINT + CMD参数。'],
    ['K8s', '基础', 'Kubernetes核心组件？', 'API Server（入口）、Scheduler（调度）、Controller Manager（控制循环）、Kubelet（节点Agent）、Etcd（存储）。'],
    ['K8s', '基础', 'Pod和Deployment的关系？', 'Pod是最小调度单位，Deployment管理Pod副本、滚动更新、回滚。'],
    
    // 算法 (5题)
    ['算法', '排序', '快排的时间复杂度？', '平均O(nlogn)，最坏O(n^2)（有序时）。优化：随机选基准、三数取中。'],
    ['算法', '排序', '排序算法稳定性？', '稳定：冒泡、插入、归并；不稳定：选择、快排、堆排。'],
    ['算法', '搜索', '二分查找的前提？', '要求有序数组。每次排除一半数据，时间复杂度O(logn)。'],
    ['算法', '数据结构', '链表和数组的对比？', '数组：随机访问O(1)，插入/删除O(n)；链表：随机访问O(n)，插入/删除O(1)。'],
    ['算法', '复杂度', '时间复杂度和大O表示法？', '大O表示算法执行时间随数据规模增长的趋势。常见：O(1)<O(logn)<O(n)<O(nlogn)<O(n^2)。'],
    
    // 缓存 (5题)
    ['缓存', 'Redis', 'Redis的持久化方式？', 'RDB（快照，定期保存）；AOF（命令日志，实时追加）。可混合使用。'],
    ['缓存', 'Redis', 'Redis缓存穿透、击穿、雪崩？', '穿透：查询不存在数据；击穿：热点key过期；雪崩：大量key同时过期。'],
    ['缓存', 'Redis', '缓存和数据库一致性？', '最终一致方案：先更新DB再删缓存（推荐）；强一致需分布式锁或2PC。'],
    ['缓存', 'Redis', '为什么用Redis不用内存？', 'Redis：持久化、分布式共享、数据结构丰富、过期策略、发布订阅。'],
    ['缓存', 'Redis', 'Redis单线程为什么快？', '纯内存操作、非阻塞I/O多路复用、单线程无上下文切换、数据结构高效。'],
    
    // 架构 (5题)
    ['架构', '设计', '分布式CAP理论？', '一致性（Consistency）、可用性（Availability）、分区容错性（Partition Tolerance），三者不可兼得。'],
    ['架构', '设计', 'BASE理论？', 'Basically Available（基本可用）、Soft state（软状态）、Eventually consistent（最终一致）。NoSQL理论基础。'],
    ['架构', '设计', '接口幂等性如何实现？', '唯一标识（请求ID）+ Redis去重；数据库唯一约束；状态机前置判断。'],
    ['架构', '设计', '限流方案有哪些？', '计数器（固定/滑动窗口）、漏桶（平滑流速）、令牌桶（允许突发）。'],
    ['架构', '设计', '负载均衡算法？', '轮询、加权轮询、最少连接、源地址哈希、一致性哈希。'],
    
    // 安全 (3题)
    ['安全', '加密', '对称和非对称加密？', '对称加密：AES/DES，加解密用同一密钥，效率高；非对称加密：RSA/ECC，公钥加密私钥解密。'],
    ['安全', '安全', 'SQL注入如何防范？', '使用PreparedStatement参数化查询、ORM框架（MyBatis #{}）、输入校验。'],
    ['安全', '安全', 'CSRF攻击及防范？', '跨站请求伪造。防范：CSRF Token、SameSite Cookie、验证Referer。'],
    
    // 测试 (3题)
    ['测试', '单元测试', 'JUnit常用注解？', '@Test、@BeforeEach、@AfterEach、@BeforeAll、@AfterAll、@Mock、@InjectMocks。'],
    ['测试', '测试', 'TDD是什么？', '测试驱动开发：先写测试（RED），再写代码（GREEN），最后重构（REFACTOR）。'],
    ['测试', '测试', 'Mockito和PowerMock的区别？', 'Mockito用于普通模拟；PowerMock可模拟静态/私有/构造方法。'],
    
    // 大数据 (3题)
    ['大数据', 'Hadoop', 'HDFS的特点？', '分布式文件系统，适合大文件存储（块默认128MB），一次写入多次读取。'],
    ['大数据', 'Spark', 'Spark和MapReduce的区别？', 'Spark基于内存计算（DAG），支持批/流/SQL/ML；MapReduce基于磁盘，仅批处理。'],
    ['大数据', 'Flink', 'Flink和Spark Streaming的区别？', 'Flink纯流式（真正的逐条处理）；Spark Streaming微批（秒级延迟）。Flink延迟更低。']
];

// 总计新增: 8+5+6+5+6+3+3+5+3+3+3+5+5+5+5+5+3+3+3 = 89题 (119+89=208题)
console.log(`准备插入 ${newQuestions.length} 道新题目`);

db.serialize(() => {
    const stmt = db.prepare(`
        INSERT INTO questions (category, subcategory, question, answer, difficulty)
        SELECT ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM questions WHERE question = ?)
    `);

    for (const q of newQuestions) {
        stmt.run(q[0], q[1], q[2], q[3], 'medium', q[2]);
    }

    stmt.finalize();

    db.get("SELECT COUNT(*) as cnt FROM questions", (err, row) => {
        if (err) {
            console.error("统计失败:", err);
        } else {
            console.log(`✅ 新增完成！当前题目总数: ${row.cnt}`);
        }
        db.close();
    });
});

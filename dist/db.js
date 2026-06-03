"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = exports.all = exports.get = exports.run = void 0;
const sqlite3 = require('sqlite3');
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(__dirname, '../data/questions.db');
const db = new sqlite3.Database(dbPath);
const run = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};
exports.run = run;
const get = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
};
exports.get = get;
const all = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.all = all;
const initDb = async () => {
    await (0, exports.run)(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await (0, exports.run)(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subcategory TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await (0, exports.run)(`
    CREATE TABLE IF NOT EXISTS custom_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT DEFAULT '自定义',
      subcategory TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
    await (0, exports.run)(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER,
      source_type TEXT CHECK(source_type IN ('system', 'custom')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
    await (0, exports.run)(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      messages TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
    await (0, exports.run)(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      is_correct BOOLEAN,
      interaction_type TEXT CHECK(interaction_type IN ('answer', 'ai')),
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(question_id) REFERENCES questions(id)
    )
  `);
    // Add missing columns for existing user_progress table
    try {
        await (0, exports.run)(`ALTER TABLE user_progress ADD COLUMN interaction_type TEXT CHECK(interaction_type IN ('answer', 'ai'))`);
    }
    catch (e) { }
    try {
        await (0, exports.run)(`ALTER TABLE user_progress ADD COLUMN tech_domain TEXT DEFAULT 'java'`);
    }
    catch (e) { }
    try {
        await (0, exports.run)(`ALTER TABLE questions ADD COLUMN tech_domain TEXT DEFAULT 'java'`);
    }
    catch (e) { }
    try {
        await (0, exports.run)(`ALTER TABLE custom_questions ADD COLUMN tech_domain TEXT DEFAULT 'java'`);
    }
    catch (e) { }
    try {
        await (0, exports.run)(`ALTER TABLE favorites ADD COLUMN tech_domain TEXT DEFAULT 'java'`);
    }
    catch (e) { }
    const count = await (0, exports.get)('SELECT COUNT(*) as count FROM questions');
    if (!count.count) {
        await seedSampleQuestions();
    }
    // 初始化技术领域
    const domainCount = await (0, exports.get)('SELECT COUNT(*) as cnt FROM tech_domains');
    if (!domainCount.cnt) {
        const domains = [
            ['java', 'Java', '☕', 'Java 企业级开发', 1],
            ['go', 'Go', '🐹', 'Go 语言开发', 2],
            ['python', 'Python', '🐍', 'Python 开发', 3],
            ['frontend', '前端', '⚛️', '前端开发', 4],
            ['database', '数据库', '🗄️', '数据库技术', 5],
            ['devops', '运维 & DevOps', '🐳', '运维与 DevOps', 6],
        ];
        for (const d of domains) {
            await (0, exports.run)('INSERT INTO tech_domains (code, name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)', d);
        }
        console.log('✅ 技术领域初始化完成');
    }
};
exports.initDb = initDb;
const seedSampleQuestions = async () => {
    const questions = [
        // ==================== Java基础 (15题) ====================
        ['Java基础', '语法', 'Java是值传递还是引用传递？', 'Java只有值传递。基本类型传递副本，引用类型传递引用的副本（即地址值的副本）。'],
        ['Java基础', '面向对象', '什么是面向对象？三大特性是什么？', '面向对象以对象为中心，三大特性：封装（隐藏内部实现）、继承（复用父类代码）、多态（同一接口不同实现）。'],
        ['Java基础', 'String', 'String、StringBuffer、StringBuilder的区别？', 'String不可变，每次操作创建新对象；StringBuffer线程安全（synchronized），速度慢；StringBuilder非线程安全，速度快。'],
        ['Java基础', '数据类型', 'int和Integer的区别？', 'int是基本数据类型，默认值0；Integer是包装类，默认值null。Integer提供了对象方法，可用于集合。Java 5+支持自动装箱/拆箱。'],
        ['Java基础', '异常', 'Error和Exception的区别？', 'Error是系统级错误（如OutOfMemoryError），程序无法处理；Exception是程序可处理的异常，分为检查异常（需throws/try-catch）和非检查异常（RuntimeException）。'],
        ['Java基础', 'IO', 'BIO、NIO、AIO的区别？', 'BIO同步阻塞，每连接一线程；NIO同步非阻塞，基于Selector单线程管理多连接；AIO异步非阻塞，基于回调。NIO适用于高并发，AIO适用于连接数多且时间长。'],
        ['Java基础', '反射', '什么是反射？有什么应用？', '反射允许程序在运行时获取类的信息（方法、字段等）并动态调用。应用：Spring依赖注入、动态代理、JUnit测试框架。'],
        ['Java基础', '注解', '元注解有哪些？', '@Retention（保留策略）、@Target（目标元素）、@Documented（生成文档）、@Inherited（可继承）、@Repeatable（可重复）。'],
        ['Java基础', '泛型', 'Java泛型是什么？类型擦除是什么？', '泛型提供编译时类型安全检查。类型擦除：编译后泛型类型被移除，替换为Object或边界类型，插入强制转换。'],
        ['Java基础', '内部类', '静态内部类和非静态内部类的区别？', '静态内部类不需要外部类实例，不能访问外部类实例变量；非静态内部类持有外部类引用，可访问所有外部类成员。'],
        ['Java基础', 'equals', 'equals和==的区别？', '==比较基本类型值或引用地址；equals是方法，默认同==，但String等类重写为比较内容。'],
        ['Java基础', 'hashCode', 'hashCode和equals的关系？', 'equals相等时hashCode必须相等；hashCode相等时equals不一定相等。重写equals必须重写hashCode。'],
        ['Java基础', 'final', 'final、finally、finalize的区别？', 'final修饰类/方法/变量；finally异常处理中保证执行；finalize是GC前调用的方法（已废弃）。'],
        ['Java基础', 'static', 'static关键字的作用？', 'static修饰的属性和方法属于类而非实例，类加载时初始化，可通过类名直接调用。'],
        ['Java基础', '接口抽象类', '接口和抽象类的区别？', '抽象类单继承，可有构造方法和实例变量；接口多实现，Java8后可有默认/静态方法。'],
        // ==================== 集合框架 (15题) ====================
        ['集合', 'List', 'ArrayList和LinkedList的区别？', 'ArrayList基于动态数组，随机访问快，插入/删除慢（需移动元素）；LinkedList基于双向链表，插入/删除快，随机访问慢。'],
        ['集合', 'Map', 'HashMap的底层原理？', 'HashMap基于数组+链表+红黑树（JDK8+）。通过hashCode计算索引，冲突时拉链法。链表长度>8且数组长度>64时转红黑树。'],
        ['集合', 'Map', 'ConcurrentHashMap的原理？', 'JDK1.7分段锁，JDK1.8 CAS + synchronized + 红黑树，锁粒度更细，并发度更高。'],
        ['集合', 'List', 'Vector和ArrayList的区别？', 'Vector线程安全（synchronized方法），ArrayList非线程安全；Vector扩容翻倍，ArrayList扩容50%。'],
        ['集合', 'Set', 'HashSet和TreeSet的区别？', 'HashSet基于HashMap，无序；TreeSet基于红黑树，有序（自然顺序或Comparator）。'],
        ['集合', 'Map', 'TreeMap和HashMap的区别？', 'HashMap无序，基于hash表；TreeMap有序（红黑树），实现SortedMap接口，可自定义Comparator。'],
        ['集合', 'Map', 'HashMap的扩容机制？', '默认容量16，负载因子0.75。元素数量>容量*负载因子时扩容为2倍，rehash重新计算索引。'],
        ['集合', 'Map', 'LinkedHashMap的原理？', '继承HashMap，双向链表维护插入顺序或访问顺序（accessOrder=true实现LRU缓存）。'],
        ['集合', '集合', 'Collection和Collections的区别？', 'Collection是集合接口（List/Set/Queue的父接口）；Collections是工具类，提供排序、同步等方法。'],
        ['集合', 'List', 'Arrays.asList()的注意事项？', '返回固定大小列表，不能增删；底层是原数组，修改数组会同步。'],
        ['集合', '遍历', 'Iterator和ListIterator的区别？', 'Iterator可单向遍历（hasNext/next），删除元素；ListIterator继承Iterator，可双向遍历，添加/修改元素。'],
        ['集合', '并发', 'CopyOnWriteArrayList的原理？', '写时复制：修改操作（add/set）复制新数组，读操作在老数组上无锁。适合读多写少场景。'],
        ['集合', 'Queue', 'ArrayBlockingQueue和LinkedBlockingQueue的区别？', 'ArrayBlockingQueue有界（数组），公平锁；LinkedBlockingQueue可有界（链表），默认Integer.MAX_VALUE。'],
        ['集合', 'Map', 'Hashtable和HashMap的区别？', 'Hashtable线程安全（synchronized），不允许null键/值；HashMap非安全，允许null。'],
        ['集合', '集合', '快速失败和安全失败的区别？', '快速失败（ArrayList）：遍历时修改抛ConcurrentModificationException；安全失败（CopyOnWriteArrayList）：遍历原集合快照。'],
        // ==================== 并发编程 (15题) ====================
        ['并发', '线程', '创建线程的几种方式？', '1.继承Thread类；2.实现Runnable接口；3.实现Callable接口（可返回结果）；4.使用线程池（Executor框架）。'],
        ['并发', '锁', 'synchronized和Lock的区别？', 'synchronized是JVM关键字，自动释放锁；Lock是API，需手动unlock，支持公平锁、可中断、尝试获取锁等高级功能。'],
        ['并发', '锁', '乐观锁和悲观锁的区别？', '悲观锁认为冲突高，先加锁（如synchronized）；乐观锁认为冲突低，通过CAS+版本号重试（如AtomicInteger）。'],
        ['并发', '线程池', '线程池的核心参数？', 'corePoolSize（核心线程数）、maximumPoolSize（最大线程数）、keepAliveTime（空闲存活时间）、unit（时间单位）、workQueue（任务队列）、threadFactory、handler（拒绝策略）。'],
        ['并发', 'AQS', '什么是AQS？', 'AbstractQueuedSynchronizer，JUC同步器基础框架。通过CLH队列和state状态实现独占/共享锁。ReentrantLock、CountDownLatch等基于它。'],
        ['并发', '锁', 'ReentrantLock的可重入性？', '同一线程可多次获取锁，每获取一次state+1，释放时state-1到0才完全释放。'],
        ['并发', 'volatile', 'volatile的作用？', '保证可见性（写操作立即刷新到主存，读从主存读）；禁止指令重排序；不保证原子性。'],
        ['并发', 'CAS', 'CAS的原理和问题？', 'Compare And Swap：比较并交换，原子操作。问题：ABA（版本号解决）、循环时间长、只能保证一个共享变量原子性。'],
        ['并发', 'ThreadLocal', 'ThreadLocal的原理和内存泄漏？', '每个线程维护ThreadLocalMap，key为ThreadLocal弱引用。内存泄漏：key为null的Entry需调用remove()清除。'],
        ['并发', '线程状态', '线程的6种状态？', 'NEW（创建）、RUNNABLE（就绪/运行）、BLOCKED（锁阻塞）、WAITING（无限等待）、TIMED_WAITING（限时等待）、TERMINATED（终止）。'],
        ['并发', '锁', '读写锁ReadWriteLock？', 'ReentrantReadWriteLock：读锁共享，写锁互斥。读多写少场景提升并发。'],
        ['并发', '同步', 'CountDownLatch和CyclicBarrier的区别？', 'CountDownLatch：一等多（await），倒计时减到0唤醒；CyclicBarrier：等多一，计满执行Runnable，可循环使用。'],
        ['并发', '同步', 'Semaphore的原理？', '信号量，控制并发线程数。acquire()获取许可，release()释放。用于限流（如数据库连接池）。'],
        ['并发', '锁', 'synchronized的锁升级过程？', '无锁 -> 偏向锁（无竞争） -> 轻量级锁（CAS自旋） -> 重量级锁（阻塞）。'],
        ['并发', '线程池', '线程池的拒绝策略有哪些？', 'AbortPolicy（抛异常，默认）、CallerRunsPolicy（调用者线程执行）、DiscardPolicy（丢弃）、DiscardOldestPolicy（丢弃队列头）。'],
        // ==================== JVM (15题) ====================
        ['JVM', '内存模型', 'JVM内存布局有哪些区域？', '线程共享：堆（对象实例）、方法区（类信息、常量、静态变量）；线程私有：程序计数器、虚拟机栈、本地方法栈。'],
        ['JVM', 'GC', '垃圾回收算法有哪些？', '标记-清除（有碎片）、复制（内存减半）、标记-整理（无碎片）、分代收集（新生代复制，老年代标记-整理）。'],
        ['JVM', '类加载', '双亲委派模型是什么？', '类加载器收到加载请求，先委派给父加载器，只有当父加载器无法加载时才自己加载。好处：避免核心类被篡改（如java.lang.String由Bootstrap加载）。'],
        ['JVM', '内存', '什么情况会发生栈溢出（StackOverflowError）？', '递归过深、大量局部变量、线程栈帧过多。可通过-Xss设置栈大小。'],
        ['JVM', 'GC', '哪些对象可作为GC Roots？', '虚拟机栈引用对象、静态变量引用对象、常量引用对象、JNI引用对象、活跃线程等。'],
        ['JVM', '调优', '常用的JVM调优参数？', '-Xms（初始堆）、-Xmx（最大堆）、-Xmn（新生代）、-XX:MetaspaceSize、-XX:+PrintGCDetails等。'],
        ['JVM', 'GC', '垃圾回收器有哪些？', 'Serial（单线程）、Parallel（吞吐优先）、CMS（低延迟）、G1（分区回收）、ZGC（毫秒级停顿）。'],
        ['JVM', '类加载', '类加载的过程？', '加载 -> 验证 -> 准备 -> 解析 -> 初始化。准备阶段为静态变量分配零值。'],
        ['JVM', '内存', '堆内存的分代？', '新生代（Eden:Survivor0:Survivor1=8:1:1）、老年代。对象先在Eden分配，Survivor间复制，年龄阈值到15进老年代。'],
        ['JVM', 'GC', 'Minor GC和Full GC的区别？', 'Minor GC：新生代回收，频繁，速度快；Full GC：整个堆+方法区回收，慢，应尽量避免。'],
        ['JVM', '内存', '直接内存是什么？', 'NIO的DirectByteBuffer分配，不受JVM堆管理，通过-XX:MaxDirectMemorySize限制。'],
        ['JVM', '调优', '如何判断对象可回收？', '引用计数法（有循环引用问题），可达性分析（GC Roots）。'],
        ['JVM', '类加载', '破坏双亲委派的例子？', 'Tomcat（隔离Web应用）、JDBC（SPI机制，使用ThreadContextClassLoader）。'],
        ['JVM', 'GC', 'G1垃圾回收器的特点？', '分区（Region）回收，优先回收垃圾最多区域（Garbage First），可预测停顿时间。'],
        ['JVM', '工具', '常用的JVM监控工具？', 'jps（进程）、jstack（线程堆栈）、jmap（堆转储）、jstat（GC统计）、VisualVM、MAT（内存分析）。'],
        // ==================== 框架 (10题) ====================
        ['框架', 'Spring', 'Spring IOC和AOP是什么？', 'IOC（控制反转）：对象创建和依赖交给容器管理；AOP（面向切面）：通过动态代理实现横切逻辑（日志、事务等）。'],
        ['框架', 'Spring', 'Bean的生命周期？', '实例化 -> 属性赋值 -> 初始化（Aware接口、BeanPostProcessor前置、@PostConstruct、afterPropertiesSet、自定义init-method） -> 使用 -> 销毁（@PreDestroy、DisposableBean、destroy-method）。'],
        ['框架', 'Spring', 'Spring事务的传播行为？', 'REQUIRED（默认，支持当前事务，无则新建）、REQUIRES_NEW（新建挂起当前）、NESTED（嵌套）、SUPPORTS、NOT_SUPPORTED、MANDATORY、NEVER。'],
        ['框架', 'Spring Boot', 'Spring Boot自动配置原理？', '@EnableAutoConfiguration + @Conditional条件注解 + spring.factories中配置的AutoConfiguration类。'],
        ['框架', 'Spring MVC', 'Spring MVC的请求流程？', '请求 -> DispatcherServlet -> HandlerMapping -> HandlerAdapter -> 拦截器preHandle -> 处理器 -> ModelAndView -> ViewResolver -> 视图渲染 -> 拦截器postHandle/afterCompletion。'],
        ['框架', 'Spring', 'Spring中Bean的作用域？', 'singleton（默认单例）、prototype（原型）、request（请求）、session、application。'],
        ['框架', 'Spring', 'Spring循环依赖如何解决？', '三级缓存（singletonObjects、earlySingletonObjects、singletonFactories）。构造器注入无法解决，需用setter/字段注入。'],
        ['框架', 'Spring Boot', 'Spring Boot Starter是什么？', 'Starters是一组依赖描述，简化Maven配置。如spring-boot-starter-web包含Spring MVC、Tomcat等。'],
        ['框架', 'MyBatis', '#{}和${}的区别？', '#{}预处理（PreparedStatement），防止SQL注入；${}直接拼接，存在注入风险。'],
        ['框架', 'Spring Cloud', '服务发现组件有哪些？', 'Eureka（AP）、Consul（CP）、Nacos（AP+CP）、Zookeeper（CP）。'],
        // ==================== 设计模式 (8题) ====================
        ['设计模式', '创建型', '单例模式的实现方式？', '饿汉式（静态常量）、懒汉式（双重检查锁、静态内部类、枚举）。枚举方式最安全，防止反射和序列化。'],
        ['设计模式', '结构型', '代理模式和装饰者模式的区别？', '代理模式控制访问，不增强功能；装饰者模式动态添加职责，需继承同一接口/抽象类。'],
        ['设计模式', '行为型', '观察者模式的应用？', 'Spring事件监听、消息队列发布-订阅。'],
        ['设计模式', '创建型', '工厂模式和抽象工厂模式的区别？', '工厂模式生产单一产品；抽象工厂生产多个产品族（如数据库连接+命令）。'],
        ['设计模式', '结构型', '适配器模式的应用？', '将不兼容接口转为兼容。如Spring MVC的HandlerAdapter，SLF4J桥接。'],
        ['设计模式', '行为型', '策略模式的应用？', '算法可动态替换。如Java Comparator、Spring的ResourceResolver。'],
        ['设计模式', '结构型', 'Spring中使用的设计模式？', '单例（Bean默认）、工厂（BeanFactory）、代理（AOP）、模板（JdbcTemplate）、策略（InstantiationStrategy）。'],
        ['设计模式', '行为型', '模板方法模式的应用？', '父类定义骨架，子类实现具体步骤。如JdbcTemplate、HttpServlet。'],
        // ==================== 网络编程 (6题) ====================
        ['网络编程', 'HTTP', 'HTTP和HTTPS的区别？', 'HTTP明文传输，HTTPS通过SSL/TLS加密；HTTPS端口443，需要证书；HTTPS保证数据完整性、身份验证。'],
        ['网络编程', 'TCP', 'TCP三次握手过程？', 'SYN_SENT -> SYN_RCVD -> ESTABLISHED。Sequence Number用于可靠传输。'],
        ['网络编程', 'TCP', 'TCP四次挥手过程？', 'FIN_WAIT_1 -> FIN_WAIT_2 -> TIME_WAIT。TIME_WAIT等待2MSL确保ACK到达。'],
        ['网络编程', 'HTTP', 'HTTP状态码分类？', '1xx信息、2xx成功（200 OK）、3xx重定向（301/302）、4xx客户端错误（404 Not Found）、5xx服务端错误（500）。'],
        ['网络编程', 'TCP', 'TCP和UDP的区别？', 'TCP面向连接可靠有序；UDP无连接不可靠，但快。'],
        ['网络编程', '协议', 'Cookie和Session的区别？', 'Cookie存在客户端，大小限制（4KB）；Session存在服务端，更安全，但集群需共享。'],
        // ==================== 数据库 (10题) ====================
        ['数据库', 'MySQL', '索引的数据结构？', 'B+树（InnoDB默认）。特点：所有数据在叶子节点，内节点只存键值，扇出高，高度低。'],
        ['数据库', 'MySQL', '聚簇索引和非聚簇索引的区别？', '聚簇索引的叶子节点存储数据行（InnoDB主键），非聚簇索引存储主键值（回表）。'],
        ['数据库', '事务', '事务的隔离级别？', '读未提交、读已提交、可重复读（MySQL默认）、串行化。解决脏读、不可重复读、幻读。'],
        ['数据库', 'MySQL', 'MySQL的存储引擎？', 'InnoDB（事务、行锁、外键）、MyISAM（表锁、全文索引，不支持事务）、Memory（内存）。'],
        ['数据库', 'SQL', '什么是索引失效？', '函数操作（WHERE LEFT(name,3)）、隐式类型转换、OR条件、LIKE %%xx、NOT IN等。'],
        ['数据库', '事务', '什么是MVCC？', '多版本并发控制，通过Undo Log保存快照。实现读已提交和可重复读。'],
        ['数据库', '优化', '如何优化慢查询？', 'explain分析、加索引、避免回表（覆盖索引）、分页优化（延迟关联）。'],
        ['数据库', 'MySQL', '主从复制的原理？', '主库binlog转存到从库中继日志，SQL线程重放。异步、半同步、全同步。'],
        ['数据库', '分库分表', '分库分表有哪些策略？', '水平分片（hash、range）、垂直分片（按业务拆分）、一致性哈希。'],
        ['数据库', 'Redis', 'Redis的数据类型？', 'String（字符串）、Hash（哈希）、List（列表）、Set（集合）、ZSet（有序集合）、Geo、HyperLogLog。'],
        // ==================== Java 8+ (6题) ====================
        ['Java 8+', 'Lambda', 'Lambda表达式的本质？', '匿名内部类的语法糖，转换为invokedynamic调用。需函数式接口（只有一个抽象方法）。'],
        ['Java 8+', 'Stream', 'Stream的中间操作和终端操作？', '中间操作：filter、map、sorted（惰性求值）；终端操作：forEach、collect、reduce（触发计算）。'],
        ['Java 8+', 'Optional', 'Optional的作用？', '避免空指针异常，明确表示可能为null的值。常用方法：ofNullable、orElse、map、flatMap。'],
        ['Java 8+', '时间API', 'LocalDate和Date的区别？', 'LocalDate不可变线程安全，区分日期/时间/时间戳；Date可变线程不安全。'],
        ['Java 8+', '接口', '接口的默认方法和静态方法？', 'default方法实现类可重写；static方法只能接口内调用。用于兼容升级。'],
        ['Java 8+', 'CompletableFuture', 'CompletableFuture的作用？', '异步编程框架，支持回调、组合（thenCombine）、异常处理（exceptionally）。'],
        // ==================== 微服务 (5题) ====================
        ['微服务', 'Spring Cloud', '什么是服务熔断？', '调用失败率阈值触发熔断（OPEN），降级返回fallback；半开（HALF_OPEN）尝试恢复。Hystrix/Resilience4j。'],
        ['微服务', '网关', 'Spring Cloud Gateway的原理？', 'WebFlux基于Netty，非阻塞。通过路由（Route）、断言（Predicate）、过滤器（Filter）转发请求。'],
        ['微服务', '配置中心', 'Nacos配置中心的优势？', '支持热更新、动态刷新、版本管理、命名空间隔离。'],
        ['微服务', '分布式事务', '分布式事务解决方案？', '2PC/XA（强一致）、TCC（补偿）、SAGA（最终一致）、Seata AT模式。'],
        ['微服务', '链路追踪', '什么是分布式链路追踪？', 'TraceId串联请求链路，Span记录调用耗时。实现：Spring Cloud Sleuth、SkyWalking、Jaeger。'],
        // ==================== 消息队列 (6题) ====================
        ['消息队列', 'Kafka', 'Kafka为什么高吞吐？', '顺序读写、零拷贝、分区并行、批量压缩、页缓存、异步刷盘。'],
        ['消息队列', 'RocketMQ', 'RocketMQ的事务消息？', '半消息（半事务）+ 本地事务回查。解决分布式事务最终一致性（如订单支付）。'],
        ['消息队列', 'RabbitMQ', 'RabbitMQ的交换机类型？', 'Direct（直连）、Topic（通配符）、Fanout（广播）、Headers（消息头）。'],
        ['消息队列', 'Kafka', 'Kafka如何保证消息顺序？', '分区内有序，设置相同key的消息发往同一分区。'],
        ['消息队列', '消息', '消息重复消费如何解决？', '消费端幂等处理（Redis SETNX、数据库唯一键、业务状态机）。'],
        ['消息队列', '消息', '如何保证消息不丢失？', '生产者ACK确认、Broker持久化（刷盘/副本）、消费者手动提交offset。']
    ];
    for (const q of questions) {
        await (0, exports.run)(`
      INSERT INTO questions (category, subcategory, question, answer, difficulty)
      VALUES (?, ?, ?, ?, ?)
    `, [q[0], q[1], q[2], q[3], 'medium']);
    }
};
exports.default = { run: exports.run, get: exports.get, all: exports.all, initDb: exports.initDb };

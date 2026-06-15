# Zotero Word Learning v0.10.5

Version 0.10.5 restores strict database path behavior while keeping the Better Notes compatibility fixes from 0.10.4.

## 修复内容

### 1. 移除默认数据库兜底读取

删除了 0.10.4 中这类逻辑：

```text
loaded default database as fallback
```

现在不会再出现：

```text
自定义路径不可用 -> 自动读取默认数据库
```

### 2. 数据库路径选择逻辑改回严格模式

现在逻辑是：

```text
用户设置了自定义数据库路径
-> 只读取用户设置的路径

用户没有设置自定义数据库路径
-> 读取 Zotero profile 下的默认路径
```

如果用户设置的路径暂时不可用，插件会显示空词库，并在 debug 中记录：

```text
database path missing: ...
```

但不会偷偷读取默认词库。

### 3. 保留 0.10.4 的 Better Notes 兼容修复

仍然保留：

- 禁用自动 fallback 侧栏注入；
- fallback 只允许浮动面板；
- 启动后多次重试刷新词库；
- 避免误挂到 Better Notes / Zotero Notes 面板。

## Assets

- `zotero-word-learning-0.10.5.xpi`
- `Word-Learning-0.10.5-source-no-README.zip`

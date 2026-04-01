---
title: "go语言样本逆向分析特点"
date: 2024-04-28 16:36:57
tags: ["reverse"]
categories: []
---

开源工具：  
<https://github.com/0xjiayu/go_parser>  
Go 语言的编译工具链会全静态链接构建二进制文件，把标准库函数和第三方 package 全部做了静态编译，再加上 Go 二进制文件中还打包进去了 runtime 和 GC(Garbage Collection，垃圾回收) 模块代码，所以导致文件结构非常复杂

## go语言分析的难点

go语言是一种适合处理高并发需求的语言，这和他的goroutine有关，这是一种轻量级线程，goroutine可以初始时只给栈分配很小的空间，然后随着使用过程中的需要自动地增长。这就是为什么Go可以开千千万万个goroutine而不会耗尽内存。  
**每次执行函数调用时Go的runtime都会进行检测，若当前栈的大小不够用，则会触发“中断”，从当前函数进入到Go的运行时库，Go的运行时库会保存此时的函数上下文环境，然后分配一个新的足够大的栈空间，将旧栈的内容拷贝到新栈中，并做一些设置**

独特的调用约定和栈管理机制，使 C/C++ 二进制文件逆向分析的经验在这里力不从心：Go 语言用的是 [continue stack 栈管理机制](<https://tiancaiamao.gitbooks.io/go-internals/content/zh/03.5.html>) 连续栈.

由于恶意软件大都是被 strip 处理过，已经去除了二进制文件里的调试信息和函数符号，所以 Go 二进制文件的逆向分析技术的探索，前期主要围绕着函数符号的恢复来展开。  
strip是抹除go语言编译产生二进制文件中的符号表，目标文件的符号表包含定位和重定位程序的符号定义和符号引用所需的信息。具体定义在：<https://docs.oracle.com/cd/E26926_01/html/E25910/chapter6-79797.html>  
隐藏在 Go 二进制文件种 **pclntab** 结构中的函数名信息，并没有被 strip 掉，而且可以通过辅助脚本在反汇编工具里将其恢复。可以通过脚本恢复出来。较火的插件有：# IDAGolangHelper但是支持的go版本比较老  
项目地址：<https://github.com/sibears/IDAGolangHelper>  
pclntab结构源代码：<https://go.dev/src/debug/gosym/pclntab.go>  
比较有用的是下面的：
    
    
    // funcName returns the name of the function found at off.
       357  func (t *LineTable) funcName(off uint32) string {
       358  	if s, ok := t.funcNames[off]; ok {
       359  		return s
       360  	}
       361  	i := bytes.IndexByte(t.funcnametab[off:], 0)
       362  	s := string(t.funcnametab[off : off+uint32(i)])
       363  	t.funcNames[off] = s
       364  	return s
       365  }
       366  
       367  // stringFrom returns a Go string found at off from a position.
       368  func (t *LineTable) stringFrom(arr []byte, off uint32) string {
       369  	if s, ok := t.strings[off]; ok {
       370  		return s
       371  	}
       372  	i := bytes.IndexByte(arr[off:], 0)
       373  	s := string(arr[off : off+uint32(i)])
       374  	t.strings[off] = s
       375  	return s
       376  }
       377  
       378  // string returns a Go string found at off.
       379  func (t *LineTable) string(off uint32) string {
       380  	return t.stringFrom(t.funcdata, off)
       381  }
       382  
       383  // functabFieldSize returns the size in bytes of a single functab field.
       384  func (t *LineTable) functabFieldSize() int {
       385  	if t.version >= ver118 {
       386  		return 4
       387  	}
       388  	return int(t.ptrsize)
       389  }
       390

![image-20240428163811902](/../../../blog-photo/image-20240428163811902.png)

结合go语言goroutine的特性，我猜测代码中一定会有对堆栈进行操作的代码。实现大概是创建一个新的 而且更大的堆栈可能是1.5倍，将原有堆栈复制到新的堆栈中并销毁原堆栈

## 堆栈操作

![image-20240428163759529](/./../pic/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/image-20240428163759529.png)  
这里是在创建新堆栈前的一些检查，以及获取堆栈信息

### `runtie_newstack` 函数 (Go 运行时)

**1\. 检查堆栈是否溢出:**  
**2\. 获取当前 Goroutine 信息:**  
**3\. 检查 Goroutine 状态:**

  * 检查 Goroutine 的状态 (`*(_QWORD *)(v2 + 16)`) 是否为特定的错误值 (`-1234LL`)。如果是，则调用 `runtime_throw` 函数抛出一个异常并跳转到 `LABEL_45` 处进行后续处理。  
**4\. 尝试使用现有栈 (可选):**
  * 如果 `v2` 和 `v3` 指向同一个内存地址，则表明该 Goroutine 当前使用的栈空间足够，不需要重新分配。
  * 否则，打印一些调试信息，然后调用 `runtime_throw` 函数抛出一个异常。  
**5\. 检查栈是否损坏 :**  
**6\. 更新 Goroutine 信息:**  
**7\. 检查 Goroutine 特殊状态:**  
**8\. 处理堆栈溢出:**  
**9\. 计算所需的新栈空间:**  
**10\. 检查新栈空间是否足够:**  
**11\. 重新分配堆栈空间:**

在分析这个的基础上我发现这个很多函数都有一个前缀runtime-

## runtime机制

在 Go 中， 有一个 runtime 库，其实现了垃圾回收，并发控制， 栈管理以及其他一些 Go 语言的关键特性。 runtime 库是每个 Go 程序的一部分，也就是说编译 Go 代码为机器代码时也会将其也编译进来。  
![image-20240428163835936](/./../pic/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/image-20240428163835936.png)  
Go 的可执行文件都比相对应的源代码文件要大很多，这恰恰说明了 Go 的 runtime 嵌入到了每一个可执行文件当中。

调用 `runtime_newproc` 函数，该函数可能用于创建一个新的 goroutine（Go 语言中的轻量级线程），并传递一些参数。

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/04/28/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[reverse](</tags/reverse/>)

[上一篇MYSQL学习笔记](</2024/06/20/MYSQL%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0-0/> "MYSQL学习笔记")

[下一篇CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

 __相关推荐

[ __2024-04-28 CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

[ __2024-01-17 PE文件浅析](</2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/> "PE文件浅析")

[ __2024-04-28 dll injection（dll注入）](</2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/> "dll injection（dll注入）")

[ __2024-07-08 wannacry勒索病毒加密解密过程分析](</2024/07/08/wannacry/> "wannacry勒索病毒加密解密过程分析")

[ __2024-10-25 PE解析器编写](</2024/10/25/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/> "PE解析器编写")

[ __2024-10-25 brute ratel C4 badger全分析文档](</2024/10/25/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/> "brute ratel C4 badger全分析文档")

![avatar](/hexo-blog/source/avatar%20img.jpg)

helson

吾生有涯，其知无涯

[文章12](</archives/>)[标签4](</tags/>)[分类1](</categories/>)

[ __Follow Me](<https://github.com/helsome>)

[ __](<https://github.com/helsome> "Github")[__](<mailto:huichuanh8@gmail.com> "Email")

__公告

This is my Blog

 __目录

  1. 1. go语言分析的难点
  2. 2. 堆栈操作
     1. 2.1. runtie_newstack 函数 (Go 运行时)
  3. 3. runtime机制

 __最新文章

[brute ratel C4 badger全分析文档](</2024/10/25/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/> "brute ratel C4 badger全分析文档")2024-10-25

[PE解析器编写](</2024/10/25/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/> "PE解析器编写")2024-10-25

[利用dll通知回调加载shellcode](</2024/10/25/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/> "利用dll通知回调加载shellcode")2024-10-25

[os cs162](</2024/09/23/os-cs162/> "os cs162")2024-09-23

[wannacry勒索病毒加密解密过程分析](</2024/07/08/wannacry/> "wannacry勒索病毒加密解密过程分析")2024-07-08

©2020 - 2024 By helson

框架 [Hexo](<https://hexo.io>)|主题 [Butterfly](<https://github.com/jerryc127/hexo-theme-butterfly>)

 ______

______
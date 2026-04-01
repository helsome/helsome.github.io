---
title: "dll injection（dll注入）"
date: 2024-04-28 14:19:52
tags: ["reverse"]
categories: []
---

DLL注入（英语：DLL injection）是一种计算机编程技术，它可以强行使另一个进程加载一个动态链接库以在其地址空间内运行指定代码，在Windows操作系统上，每个进程都有独立的进程空间，即一个进程是无法直接操作另一个进程的数据的（事实上，不仅Windows，许多操作系统也是如此）。但是DLL注入是用一种不直接的方式，来实现操作其他进程的数据。假设我们有一个DLL文件，里面有操作目标进程数据的程序代码逻辑，DLL注入就是使目标进程加载这个DLL，加载后，这个DLL就成为目标进程的一部分，目标进程的数据也就可以直接操作了

## DLL注入基本流程

### （1） 打开目标进程
    
    
    HANDLE OpenProcess(
      DWORD dwDesiredAccess,
      BOOL  bInheritHandle,
      DWORD dwProcessId
    );
    //- dwDesiredAccess 访问权限
    //- bInheritHandle 是否继承句柄
    //- dwProcessId 要打开的进程pid
    
    
    HANDLE hProcess = OpenProcess(PROCESS_ALL_ACCESS,FALSE,pid);
    if (NULL == hProcess) {
    	OutputDebugString("Cannot open this process.\n");
    	return -1;
    }

### （2） 在目标进程开辟一段内存空间
    
    
    LPVOID VirtualAllocEx(
      HANDLE hProcess,
      LPVOID lpAddress,
      SIZE_T dwSize,
      DWORD  flAllocationType,
      DWORD  flProtect
    );

  * hProcess 要向其申请内存空间的进程
  * lpAddress 申请的内存所在的地址，传入NULL函数帮我们决定地址
  * dwSize 申请的内存空间的大小，单位为字节
  * flAllocationType 要申请的内存空间类型
  * flProtect 内存保护常量

    
    
    LPVOID lpAddr = VirtualAllocEx(hProcess, NULL, strlen(DllPath), MEM_COMMIT, PAGE_READWRITE);
    if (NULL == lpAddr) {
    	OutputDebugString("Cannot alloc memory.\n");
    	return -1;
    }

### （3） 往开辟的内存空间中写入要注入的DLL的路径
    
    
    BOOL WriteProcessMemory(
      HANDLE  hProcess,
      LPVOID  lpBaseAddress,
      LPCVOID lpBuffer,
      SIZE_T  nSize,
      SIZE_T  *lpNumberOfBytesWritten
    );

  * hProcess 要写入的进程的句柄
  * lpBaseAddress 要写入的目标地址
  * lpBuffer 要写入的数据
  * nSize 要写入的数据的大小
  * lpNumberOfBytesWritten 一个用于接收传入目标进程的字节数的指针变量
  * 返回值： 返回一个非零值代表写入成功，返回零则写入失败

    
    
    BOOL isOk = WriteProcessMemory(hProcess , lpAddr, DllPath, strlen(DllPath), NULL);
    if (!isOk) {
    	OutputDebugString("Cannot write memory.\n");
    	return -1;
    }

### （4） 给目标创建一个线程， 加载DLL

GetModuleHandle函数根据模块名称得到模块的句柄  
返回值：指定模块的句柄  
GetProcAddress函数可以根据函数名来得到模块中的一个导出函数的地址  
CreateRemoteThread用于在指定进程的虚拟空间中开启一个线程
    
    
    HANDLE CreateRemoteThread(
      HANDLE                 hProcess,
      LPSECURITY_ATTRIBUTES  lpThreadAttributes,
      SIZE_T                 dwStackSize,
      LPTHREAD_START_ROUTINE lpStartAddress,
      LPVOID                 lpParameter,
      DWORD                  dwCreationFlags,
      LPDWORD                lpThreadId
    );

  * Process 目标进程句柄
  * lpThreadAttributes 线程安全属性，传入NULL时使用默认属性
  * dwStackSize 线程初始栈大小，传入0使用默认栈大小
  * lpStartAddress 线程中要执行的函数的地址
  * lpParameter 传入线程函数的参数
  * dwCreationFlags 创建线程的参数，传入0时线程立即执行
  * lpThreadId 接收线程标识的指针，传入NULL时线程不返回标识

返回值：创建成功返回一个线程句柄，否则返回一个NULL
    
    
    HMODULE hKernel32Module = GetModuleHandle("kernel32.dll");
    if (NULL == hKernel32Module) {
    	OutputDebugString("Cannot find kernel32.dll.\n");
    	return -1;
    }
    FARPROC hFarProc = GetProcAddress(hKernel32Module, "LoadLibraryA");
    if (NULL == hFarProc) {
    	OutputDebugString("Cannot get function address.\n");
    	return -1;
    }
    HANDLE hThread = CreateRemoteThread(hProcess
        , NULL
        , 0
    	, (LPTHREAD_START_ROUTINE)hFarProc
    	, lpAddr
    	, 0
    	, NULL 
    );

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[reverse](</tags/reverse/>)

[上一篇CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

[下一篇PE文件浅析](</2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/> "PE文件浅析")

 __相关推荐

[ __2024-04-28 CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

[ __2024-01-17 PE文件浅析](</2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/> "PE文件浅析")

[ __2024-04-28 go语言样本逆向分析特点](</2024/04/28/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/> "go语言样本逆向分析特点")

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

  1. 1. DLL注入基本流程
     1. 1.1. （1） 打开目标进程
     2. 1.2. （2） 在目标进程开辟一段内存空间
     3. 1.3. （3） 往开辟的内存空间中写入要注入的DLL的路径
     4. 1.4. （4） 给目标创建一个线程， 加载DLL

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
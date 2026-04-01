---
title: "CobaltStrike UPX脱壳加壳"
date: 2024-04-28 16:33:26
tags: ["reverse"]
categories: []
---

## UPX加壳：

[使用x64dbg脱壳之开源壳upx - 知乎 (zhihu.com)](<https://zhuanlan.zhihu.com/p/34263050>)

压缩后FILE size明显变小

![image-20240313131357499](/./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313131357499.png)

![image-20240313131914264](/./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313131914264.png)

![image-20240313200435441](./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313200435441.png)

查壳，发现已经加上了壳、

过了一些查杀，

![image-20240313132033359](/./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313132033359.png)

自动脱壳方法（一般不灵）
    
    
    upx -d /path/to/file

## 手动脱壳

用ada打开，发现加壳后发生了很大变化

![image-20240313133646334](/./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313133646334.png)

找到OPE（原始程序入口地址）

设置**硬件断点** （不会修改原有代码）hardwware

### c++程序的OEP特征
    
    
    00408027 >/$  55             push ebp
    
    00408028  |.  8BEC           mov ebp,esp
    
    0040802A  |.  6A FF          push -0x1
    
    0040802C  |.  68 F0F14000    push C++.0040F1F0
    
    00408031  |.  68 84AF4000    push C++.0040AF84                        ;  SE 处理程序安装
    
    00408036  |.  64:A1 00000000 mov eax,dword ptr fs:[0]
    
    0040803C  |.  50             push eax
    
    0040803D  |.  64:8925 000000>mov dword ptr fs:[0],esp
    
    00408044  |.  83EC 58        sub esp,0x58
    
    00408047  |.  53             push ebx
    
    00408048  |.  56             push esi
    
    00408049  |.  57             push edi                                 ;  ntdll.7C930228
    
    0040804A  |.  8965 E8        mov [local.6],esp
    
    0040804D  |.  FF15 E4F04000  call dword ptr ds:[<&KERNEL32.GetVersion>;  kernel32.GetVersion
    
    00408053  |.  33D2           xor edx,edx                              ;  ntdll.KiFastSystemCallRet
    
    00408055  |.  8AD4           mov dl,ah
    
    00408057  |.  8915 D06B4100  mov dword ptr ds:[0x416BD0],edx          ;  ntdll.KiFastSystemCallRet
    
    0040805D  |.  8BC8           mov ecx,eax
    
    0040805F  |.  81E1 FF000000  and ecx,0xFF
    
    00408065  |.  890D CC6B4100  mov dword ptr ds:[0x416BCC],ecx
    
    0040806B  |.  C1E1 08        shl ecx,0x8

有点奇怪，dump出来是kernel的dll

![image-20240313211616996](/./../../blog-photo/image-20240313211616996.png)

### 单步跟踪法

### 平衡堆栈法

一般可以通过判断ESP，在pop ESP后一般会出现程序的入口点。

ESP | 堆栈指针(Stack Point)寄存器 | 只做堆栈的栈顶指针; 不能用于算术运算与数据传  
---|---|---  
  
### 汇编指令复习

指令 | 名称 | 示例 | 备注  
---|---|---|---  
MOV | 传送指令 | MOV dest, src | 将数据从src移动到dest  
PUSH | 进栈指令 | PUSH src | 把源操作数src压入堆栈  
POP | 出栈指令 | POP desc | 从栈顶弹出字数据到dest  
指令 | 名称 | 示例 | 备注  
---|---|---|---  
JNE | 条件转移指令 |  | zf =0 时跳转到标号为label的位置  
JMP | 无条件转移指令 | JMP lable | 无条件地转移到标号为label的位置  
CALL | 过程调用指令 | CALL labal | 直接调用label  
JE | 条件转移指令 | JE lable | zf =1 时跳转到标号为label的位置  
  
### 内存镜像法

alt+m 看内存信息 UPX2处F2下断点，F9运行

![image-20240313214147894](/./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313214147894.png)

出现下图所示，根据OPE特征判断jmp artifact。。。处为程序入口点

![image-20240313214536442](/./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313214536442.png)

使用Scylla插件脱壳

![image-20240313214917067](/./pic/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/image-20240313214917067.png)

**成功**

### 秒到ope

直接CTRL+F，输入popad //在这里不行

]]

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[reverse](</tags/reverse/>)

[上一篇go语言样本逆向分析特点](</2024/04/28/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/> "go语言样本逆向分析特点")

[下一篇dll injection（dll注入）](</2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/> "dll injection（dll注入）")

 __相关推荐

[ __2024-01-17 PE文件浅析](</2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/> "PE文件浅析")

[ __2024-04-28 dll injection（dll注入）](</2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/> "dll injection（dll注入）")

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

  1. 1. UPX加壳：
  2. 2. 手动脱壳
     1. 2.1. c++程序的OEP特征
     2. 2.2. 单步跟踪法
     3. 2.3. 平衡堆栈法
     4. 2.4. 汇编指令复习
     5. 2.5. 内存镜像法
     6. 2.6. 秒到ope

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
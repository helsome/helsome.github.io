---
title: "PE文件浅析"
date: 2024-01-17 22:45:02
tags: ["reverse"]
categories: []
---

# PE文件浅析

## 相关术语

### 文件偏移地址（File Offset,FOA）

数据在PE文件中的地址。这是文件在磁盘中存放是相对于文件开头的偏移。

### 装载基址（Image Base）

PE文件装入内存时的基地址。

### 虚拟内存地址（Virtual Address，VA）

PE文件中的指令被装入内存之后的地址。

### 相对虚拟地址（Relative Virtual Address，RVA）

内存地址相对于映射基址的偏移量。

### 三者关系

VA=Image Base+ RVA

# PE解码器

![image-20231203210957047](/./../pic/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/image-20231203210957047.png)

## IMAGE_DATA_DIRECTORY 数据目录结构
    
    
    typedef struct _IMAGE_DATA_DIRECTORY {
      DWORD VirtualAddress;                   /**指向某个数据的相对虚拟地址   RAV  偏移0x00**/
      DWORD Size;                             /**某个数据块的大小                 偏移0x04**/
    } IMAGE_DATA_DIRECTORY, *PIMAGE_DATA_DIRECTORY;
    
    
    //定位目录项的方法(以导出表为例)：    所有操作都在FileBuffer状态下完成
     
    //1、指向相关内容
    PIMAGE_DOS_HEADER pDosHeader = (PIMAGE_DOS_HEADER)(FileAddress);
    PIMAGE_FILE_HEADER pFileHeader = (PIMAGE_FILE_HEADER)((DWORD)pDosHeader + pDosHeader->e_lfanew + 4);
    PIMAGE_OPTIONAL_HEADER32 pOptionalHeader = (PIMAGE_OPTIONAL_HEADER32)((DWORD)pFileHeader + sizeof(IMAGE_FILE_HEADER));
     
    //2、获取导出表的地址(目录项的第0个成员)
    DWORD ExportDirectory_RAVAdd = pOptionalHeader->DataDirectory[0].VirtualAddress;
    DWORD ExportDirectory_FOAAdd = 0;

### IMAGE_IMPORT_DESCRIPTOR导入表

descriptor->描述符![image-20231204171557646](/./../pic/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/image-20231204171557646.png)

![image-20231204174520603](/./../pic/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/image-20231204174520603.png)

#### OriginalFirstThunk

**这个值是一个4字节的RVA地址，这个地址指向了导入名称表(INT)**，INT是一个IMAGE_THUNK_DATA结构体数组，这个结构体的最后一个成员内容为0时数组结束。这个数组的每一个成员又指向了一个IMAGE_IMPORT_BY_NAME结构体，这个结构体包含了两个成员函数序号和函数名，不过这个序号一般没什么用，所以有的编译器会把函数序号置0。函数名可以当作一个以0结尾的字符串。

#### FirstThunk

**这个值是一个4字节的RVA地址，这个地址指向了导入地址表(IAT)**，这个IAT和INT一样，也是一个IMAGE_THUNK_DATA结构体数组，不过它在程序载入前和载入后由两种状态，在程序载入前它的结构和内容和INT表完全一样，但却是两个不同的表，指向了IMAGE_IMPORT_BY_NAME结构体。在程序载入后，他的结构和INT表一样，但内容就不一样了，里面存放的都是导入函数的地址。**

![image-20231204172951439](/./../pic/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/image-20231204172951439.png)

![image-20231204173247411](/./../pic/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/image-20231204173247411.png)

节表各成员意义详解。

![image-20231128183309800](/./../pic/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/image-20231128183309800.png)

**PE文件头保存着整个PE文件的索引信息，可以帮助PE装载器定位资源，而节则保存着整个PE文件的所有资源。正因为如此，所以存在着这样的说法：头是节的描述，节是头的具体化。**

参考文章：

<https://www.cnblogs.com/onetrainee/p/12938085.html>

<https://bbs.kanxue.com/thread-252795.htm#%E7%AC%AC%E4%B8%80%E8%8A%82%EF%BC%9Ape%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84>

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[reverse](</tags/reverse/>)

[上一篇dll injection（dll注入）](</2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/> "dll injection（dll注入）")

[下一篇Hello World](</2024/01/17/hello-world/> "Hello World")

 __相关推荐

[ __2024-04-28 CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

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

  1. 1. PE文件浅析
     1. 1.1. 相关术语
        1. 1.1.1. 文件偏移地址（File Offset,FOA）
        2. 1.1.2. 装载基址（Image Base）
        3. 1.1.3. 虚拟内存地址（Virtual Address，VA）
        4. 1.1.4. 相对虚拟地址（Relative Virtual Address，RVA）
        5. 1.1.5. 三者关系
  2. 2. PE解码器
     1. 2.1. IMAGE_DATA_DIRECTORY 数据目录结构
        1. 2.1.1. IMAGE_IMPORT_DESCRIPTOR导入表
           1. 2.1.1.1. OriginalFirstThunk
           2. 2.1.1.2. FirstThunk

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
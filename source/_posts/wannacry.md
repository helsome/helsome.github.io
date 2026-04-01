---
title: "wannacry勒索病毒加密解密过程分析"
date: 2024-07-08 17:46:32
tags: ["reverse"]
categories: []
---

## 病毒介绍

*遭受WannaCry病毒侵害的电脑，其文件将被加密锁死，惯常来说，受害用户支付赎金后 可以获得解密密钥，恢复这些文件。但是根据火绒工程师的分析，遭受WannaCry攻击的 用户可能会永远失去这些文件。 WannaCry 病毒存在一个致命缺陷，即病毒作者无法明确认定哪些受害者支付了赎金，因 此很难给相应的解密密钥，所以用户即使支付了赎金，也未必能顺利获得密钥该电脑系统 及文件依旧无法得到恢复。 至于网上流传的各种“解密方法”，基本上是没用的，请大家切勿听信谎言，以防遭受更多 财产损失。一些安全厂商提供的“解密工具”，其实只是“文件恢复工具”，可以恢复一些被 删除的文件，但是作用有限。  
**因为病毒是生成加密过的用户文件后再删除原始文件** ，所以存在通过文件恢复类工具恢复 原始未加密文件的可能。但是因为病毒对文件系统的修改操作过于频繁，导致被删除的原 始文件数据块被覆盖，致使实际恢复效果有限。且随着系统持续运行，恢复类工具恢复数 据的可能性会显著降低。*  
该病毒分为两个部分：

  1. 蠕虫部分，用于病毒传播，并释放出勒索病毒。

  2. 勒索病毒部分，加密用户文件索要赎金。

以下是对wnry的行为分析。关于病毒这一部分的分析，网上已经很丰富了。相应的分析在文末会有链接。我也没有必要再赘述，本文主要对其加解密部分进行分析。

![image-20240708175204572](./../pic/post/image-20240708175204572.png)

![image-20240708175710023](/./../pic/post/image-20240708175710023.png)

## t.wnry的解密过程

为什么要单独提这个呢，是因为这一部分的解密逻辑于后面是一致的。

![image-20240708180613457](/./../pic/post/image-20240708180613457.png)

t.wnry使用的是Rijndael S-Box(AES)的一种加密算法，可以使用Hash & Crypto Detector工具来检测加密算法。这里AES所使用的key是包含在t.wnry中的，同时处于加密状态  
首选会调用CryptImportKey去导入key，再继续进入CryptImportKey函数

开始先获取加密的上下文，然后在导入key，在跟进CryptAcquireContextA

![image-20240708180639448](/./../pic/post/image-20240708180639448.png)

![image-20240708180647187](/./../pic/post/image-20240708180647187.png)

Key需要解密，使用的是系统自带的解密API，如下图所示：

![image-20240708180711847](/./../pic/post/image-20240708180711847.png)

这里的解密密钥是保存在进程内存中的（RSA2）

![image-20240708180726489](/./../pic/post/image-20240708180726489.png)

![image-20240708180731340](/./../pic/post/image-20240708180731340.png)

加密Key的是一个RSA2的算法，上面的数据是一个私钥  
进入解密函数，这个函数的作用是对真实密钥进行扩展操作，根据算法位数进行相应的扩展。  
然后就调用sub_40350F解密，解密的结果copy到缓冲区，

![image-20240708180802442](/./../pic/post/image-20240708180802442.png)

接下来主要分析加密dll文件，在加密前会加载密钥，在加密过程中程序会规避系统运行所需文件以及自身文件  
这里为了分析方便，所以先将内存中的t.wnry.dll文件dump出来。dump的方法如下：  
1）使用x64dbg动态调试至解密后的地方，然后记录解密内容的首地址和长度。  
2）使用PETools工具将wcry.exe进程的内存dump下来(右键菜单Dump Partial)。

![image-20240708180844705](/./../pic/post/image-20240708180844705.png)

我们可以看到EAX寄存器中pe头“mz”

![image-20240708180855729](/./../pic/post/image-20240708180855729.png)

![image-20240708181433832](/./../pic/post/image-20240708181433832.png)

dump下来即可

## 加密过程

1.在本地生成一组密钥对：私钥B和公钥B  
2.然后作者使用自己的公钥A对本地的私钥B进行RSA加密  
3.加密文件前再生成一个16位的随机Key来  
4.使用本地公钥B对随机Key进行RSA加密，然后再保存到加密文件的头部。注意：每个文件的加密Key都是随机不同的。每次加密都会重新生成key。所以同一个文件的两次密文是不同的。  
5.然后使用随机Key对文件内容进行AES对称加密。

加密过程如下图所示

![image-20240708175822289](/./../pic/post/image-20240708175822289.png)

为什么会使用这么复杂的加密方式呢？这主要是效率上的考量，回顾密码学里的知识，AES作为对称加密技术，他的加密效率远高于RSA。但是RSA作为非对称加密技术，安全性更强。因此使用aes密钥加密文件（效率很高）后再将aes密钥加密。且加密两次，那么解密是十分困难的。

其加解密用到的是系统自带API，通过GetProcAddress来获取地址动态调用的。  
**CryptAcquireContext** 函数用于获取特定[加密服务提供程序](<https://learn.microsoft.com/zh-cn/windows/desktop/SecGloss/c-gly>)中特定[密钥容器](<https://learn.microsoft.com/zh-cn/windows/desktop/SecGloss/k-gly>)的句柄 (CSP) 。 此返回的句柄用于调用使用所选 CSP 的 [CryptoAPI](<https://learn.microsoft.com/zh-cn/windows/desktop/SecGloss/c-gly>) 函数。  
**BCryptImportKey** 函数从密钥 [BLOB](<https://learn.microsoft.com/zh-cn/windows/desktop/SecGloss/b-gly>) 导入对称密钥。[cryptImportKey 函数 (wincrypt.h) - Win32 apps | Microsoft Learn](<https://learn.microsoft.com/zh-cn/windows/win32/api/wincrypt/nf-wincrypt-cryptimportkey>)  
![image-20240708181755145](/./../pic/post/image-20240708181755145.png)`[in] pbData`**一个 BYTE** 数组，其中包含[一个 PUBLICKEYSTRUC](<https://learn.microsoft.com/zh-cn/windows/desktop/api/wincrypt/ns-wincrypt-publickeystruc>) BLOB 标头，后跟加密密钥。 此密钥 BLOB 由 [CryptExportKey](<https://learn.microsoft.com/zh-cn/windows/desktop/api/wincrypt/nf-wincrypt-cryptexportkey>) 函数创建，此应用程序或可能在另一台计算机上运行的其他应用程序创建。  
**CryptEncrypt** 函数加密数据。 用于加密数据的算法由 CSP 模块持有的密钥指定，并由 _hKey_ 参数引用。  
**CryptDecrypt** 函数使用 [CryptEncrypt](<https://learn.microsoft.com/zh-cn/windows/desktop/api/wincrypt/nf-wincrypt-cryptencrypt>) 函数解密以前加密的数据。  
加密是会加载相应dll  
![image-20240708181803086](/./../pic/post/image-20240708181803086.png)

这里是生成AES密钥 -随机生成  
![image-20240708181814182](/./../pic/post/image-20240708181814182.png)  
![image-20240708181827962](/./../pic/post/image-20240708181827962.png)

![image-20240708181833127](/./../pic/post/image-20240708181833127.png)  
![image-20240708181840941](/./../pic/post/image-20240708181840941.png)

要想实现解密可以通过拦截aes的key被加密即可，但是由于每次生成的key都为随机，所以这种解密方法不具有通用性。只能解密拦截的文档。  
那我们就尝试拦截密钥对的生成，可这个生成是在病毒刚刚发作的时候进行的。我们是不可能预知这个操作的。但这里可能存在一个漏洞，就是生成的明文私钥，还可能残留在内存中，只要原来的明文内存没有被覆盖掉，那就有可能在内存中找到。这就是一个希望，类似于磁盘恢复一样，在内存中恢复私钥。

拦截的位置如下所示

![image-20240708182056690](/./../pic/post/image-20240708182056690.png)

如下图：  
该函数的主要功能是导出密钥数据并使用另一个密钥进行分块加密，然后将结果存储在全局内存块中。在加密后会将原来的明文内容覆盖掉

![image-20240708181923825](/./../pic/post/image-20240708181923825.png)

**密钥生成和处理的步骤**

  1. **导出密钥** ：

     * 使用 `CryptExportKey` 函数导出密钥数据到 `pbData` 缓冲区。
  2. **获取密钥参数** ：

     * 使用 `CryptGetKeyParam` 函数获取用于加密的密钥参数，存储在 `v25` 中。
  3. **计算分块信息** ：

     * 根据获取的密钥参数，计算每块的数据大小及总块数。
  4. **分块加密** ：

     * 分配内存块 `hMem` 用于存储加密后的数据。
     * 逐块处理数据，将每块数据存储到 `v27` 中，并使用 `dword_1000D948` 函数对其进行加密，然后将加密后的数据复制到 `hMem` 中。
  5. **清空缓冲区** ：

     * 在加密完成或发生错误后，清空 `pbData` 缓冲区。
     * 如果发生错误，还会清空 `v27` 缓冲区，并释放分配的全局内存块 `hMem`。  
下面这里进行清空操作

![image-20240708182123538](/./../pic/post/image-20240708182123538.png)

虽然这里进行了清空操作，但是依然会有一段时间会在内存中出现  
我们定位 **`pbData` 缓冲区**:

  * 用于存储 `CryptExportKey` 导出的密钥数据。

  * 如果 `CryptExportKey` 或其他操作失败，`pbData` 会被清零。

  * 在分块加密之后，`pbData` 被清零。

![image-20240708182138239](/./../pic/post/image-20240708182138239.png)

这里无法对该dll进行动态调试，需要进行一些操作,需要讲application改为tasksche.exe

![image-20240708182155076](/./../pic/post/image-20240708182155076.png)

**定位过程**  
在分析给定的代码时，`pbData` 的值在 `GlobalFree` 之前存放在内存位置中，而不是在特定的寄存器中。我们可以通过代码的执行路径来定位 `pbData` 的值存放在哪个寄存器或内存位置中。  
首先，`pbData` 是一个 4096 字节的缓冲区，用于存储从 `CryptExportKey` 导出的密钥数据。整个分析过程可以分为几个关键步骤：  
在分析给定的代码时，`pbData` 的值在 `GlobalFree` 之前存放在内存位置中，而不是在特定的寄存器中。我们可以通过代码的执行路径来定位 `pbData` 的值存放在哪个寄存器或内存位置中。  
首先，`pbData` 是一个 4096 字节的缓冲区，用于存储从 `CryptExportKey` 导出的密钥数据。整个分析过程可以分为几个关键步骤：

  1. `CryptExportKey` 导出密钥数据
         
         call    ds:CryptExportKey
         test    eax, eax
         jnz     short loc_100041C2

如果 `CryptExportKey` 调用成功（`eax` 非零），代码会跳转到 `loc_100041C2` 继续执行。
  2. `pbData` 的值在内存中的存储  
`pbData` 在内存中的偏移量为 `0x30`（即 `esp+2024h+pbData`），这是一个固定的位置。
  3. 清空 `pbData` 缓冲区  
如果任何步骤失败，会清空 `pbData` 缓冲区。
         
         mov     ecx, 1000h
         loc_100041F2:
         mov     byte ptr [eax], 0
         inc     eax
         dec     ecx
         jnz     short loc_100041F2

在这个代码块中，`pbData` 被清零。
  4. 成功路径中的 `pbData` 访问  
在成功路径中，`pbData` 被复制到另一个缓冲区中以进行进一步处理。
         
         lea     esi, [esp+eax+2028h+pbData]

这里 `esi` 指向 `pbData` 缓冲区。
  5. 清空 `pbData` 缓冲区的最后一步  
在跳转到 `loc_10004300` 时，`pbData` 缓冲区将被再次清空：
         
         mov     ecx, [esp+2024h+pbData]
         mov     edx, 1000h
         loc_10004309:
         mov     byte ptr [ecx], 0
         inc     ecx
         dec     edx
         jnz     short loc_10004309

`ecx` 被设置为指向 `pbData` 缓冲区的起始地址，并通过循环清零该缓冲区。
  6. 释放内存前的 `pbData` 存储  
在 `GlobalFree` 调用之前，`pbData` 的值已经被存储在 `esp+2024h+hMem`:
         
         mov     eax, [esp+2024h+hMem]
         push    eax
         call    ds:GlobalFree

`pbData` 的值在 `GlobalFree` 之前存放在内存位置 `esp+2024h+pbData` 和 `esp+2024h+hMem` 中。具体的寄存器中并没有直接存储 `pbData` 的值，而是通过内存位置间接访问。

rsa加密的私钥

![image-20240708182235103](/./../pic/post/image-20240708182235103.png)

作者公钥->本地私钥->本地公钥->随机Key->加密文档  
整个过程都是环环相扣的。如果想要解密你的文档，可能只有将你的私钥提供给作者，然后作者再使用自己的私钥将你的私钥解密。然后在发送给你一个未加密的私钥。最后你使用这个私钥来解密自己的文档。

没有作者的私钥就永远无法解密文档。但本着探索的精神，可以下断点使得第二次rsa加密不进行，然后编写程序对文档进行还原：
    
    
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    import base64
    
    # 替换为rsa公钥私钥即可
    rsa_private_key_pem = b"""-----BEGIN RSA PRIVATE KEY-----
    ...
    -----END RSA PRIVATE KEY-----"""
    rsa_public_key_pem = b"""-----BEGIN PUBLIC KEY-----
    ...
    -----END PUBLIC KEY-----"""
    
    # 已加密的 AES 密钥（用 RSA 加密）
    encrypted_aes_key_base64 = "..."
    encrypted_aes_key = base64.b64decode(encrypted_aes_key_base64)
    
    # AES 加密的密文（用 AES 加密）
    ciphertext_base64 = "..."
    ciphertext = base64.b64decode(ciphertext_base64)
    
    # 初始化 RSA 私钥对象
    rsa_private_key = serialization.load_pem_private_key(
        rsa_private_key_pem,
        password=None,
    )
    
    # 用 RSA 私钥解密 AES 密钥
    aes_key = rsa_private_key.decrypt(
        encrypted_aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # 假设 AES 使用 CBC 模式加密，初始化向量 IV 通常是密文的前 16 个字节
    iv = ciphertext[:16]
    actual_ciphertext = ciphertext[16:]
    
    # 初始化 AES 解密对象
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    
    # 解密 AES 密文
    plaintext_padded = decryptor.update(actual_ciphertext) + decryptor.finalize()
    
    # 移除填充 (PKCS7)
    padding_len = plaintext_padded[-1]
    plaintext = plaintext_padded[:-padding_len]
    
    # 输出明文
    print("明文:", plaintext.decode('utf-8'))

## 总结

wannacry是一个相当复杂的样本，本人不觉得自己的分析会比从业多年的大牛更加深入有条理。本文对加密策略的分析与解密的尝试也是对网上已有文章的进一步拓展。

参考文章：

<https://3gstudent.github.io/%E9%80%86%E5%90%91%E5%88%86%E6%9E%90-%E4%BD%BF%E7%94%A8IDA%E5%8A%A8%E6%80%81%E8%B0%83%E8%AF%95WanaCrypt0r%E4%B8%AD%E7%9A%84tasksche.exe>

[[原创]Wannacry勒索病毒样本分析-软件逆向-看雪-安全社区|安全招聘|kanxue.com](<https://bbs.kanxue.com/thread-267595.htm#msg_header_h1_6>)

[[下载]永恒之蓝样本（勒索病毒）-软件逆向-看雪-安全社区|安全招聘|kanxue.com](<https://bbs.kanxue.com/thread-217586-2.htm>)

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/07/08/wannacry/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[reverse](</tags/reverse/>)

[上一篇os cs162](</2024/09/23/os-cs162/> "os cs162")

[下一篇博客踩坑日记](</2024/07/08/blog%E6%8A%98%E8%85%BE%E6%97%A5%E8%AE%B0/> "博客踩坑日记")

 __相关推荐

[ __2024-04-28 CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

[ __2024-01-17 PE文件浅析](</2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/> "PE文件浅析")

[ __2024-04-28 dll injection（dll注入）](</2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/> "dll injection（dll注入）")

[ __2024-04-28 go语言样本逆向分析特点](</2024/04/28/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/> "go语言样本逆向分析特点")

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

  1. 1. 病毒介绍
  2. 2. t.wnry的解密过程
  3. 3. 加密过程
  4. 4. 总结

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
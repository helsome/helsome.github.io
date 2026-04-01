---
title: "博客踩坑日记"
date: 2024-07-08 12:55:10
tags: ["随笔"]
categories: []
---

更新这篇文章的原因是记录自己在hexo搭建博客中踩得各种坑。目的是为了提醒自己，下次同样问题的时候可以不用再查。如果我的踩坑记录能帮到其他人，那自然是更好。

## hexo d 报 Error: Spawn failed

![image-20240708130032499](/./../pic/blog%E8%B8%A9%E5%9D%91%E6%97%A5%E8%AE%B0/image-20240708130032499.png)

这里出错的原因是因为git 进行push或者hexo d的时候改变了一些.deploy_git文件下的内容。

解决方法是删除.deploy_git文件夹（在blog的目录中）;

查询到的方法为
    
    
    ##删除git提交内容文件夹
    rm -rf .deploy_git/
    
    ##执行
    git config --global core.autocrlf false
    
    ##最后
    hexo clean && hexo g && hexo d

但是我这里报错

![image-20240708141925674](/./../pic/blog%E8%B8%A9%E5%9D%91%E6%97%A5%E8%AE%B0/image-20240708141925674.png)

ls看一下

![image-20240708141949289](/./../pic/blog%E8%B8%A9%E5%9D%91%E6%97%A5%E8%AE%B0/image-20240708141949289.png)

删除当前目录下的所有文件及目录，命令行为：
    
    
    rm  -r  *

文件一旦通过rm命令删除，则无法恢复，所以必须格外小心地使用该命令。

执行后，该文件夹中所有文件都被删除

![image-20240708142331660](/./../pic/blog%E8%B8%A9%E5%9D%91%E6%97%A5%E8%AE%B0/image-20240708142331660.png)

最后
    
    
    hexo clean && hexo g && hexo d

解决后上传成功，但是在一段时间后又出来了新的问题

![image-20240708145338078](/./../pic/blog%E8%B8%A9%E5%9D%91%E6%97%A5%E8%AE%B0/image-20240708145338078.png)

应该是网络原因。

[Git解决fatal: Could not read from remote repository.的问题-CSDN博客](<https://blog.csdn.net/baoyin0822/article/details/122584931>)

# 解决cmd中运行Hexo报错hexo : 无法加载文件hexo.ps1，因为在此系统上禁止运行脚本

![image-20240708144715439](/./../pic/blog%E8%B8%A9%E5%9D%91%E6%97%A5%E8%AE%B0/image-20240708144715439.png)

解决方法：

允许即可

![image-20240708144846305](/./../pic/blog%E8%B8%A9%E5%9D%91%E6%97%A5%E8%AE%B0/image-20240708144846305.png)

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/07/08/blog%E6%8A%98%E8%85%BE%E6%97%A5%E8%AE%B0/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[随笔](</tags/%E9%9A%8F%E7%AC%94/>)

[上一篇wannacry勒索病毒加密解密过程分析](</2024/07/08/wannacry/> "wannacry勒索病毒加密解密过程分析")

[下一篇MYSQL学习笔记](</2024/06/20/MYSQL%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0-0/> "MYSQL学习笔记")

![avatar](/hexo-blog/source/avatar%20img.jpg)

helson

吾生有涯，其知无涯

[文章12](</archives/>)[标签4](</tags/>)[分类1](</categories/>)

[ __Follow Me](<https://github.com/helsome>)

[ __](<https://github.com/helsome> "Github")[__](<mailto:huichuanh8@gmail.com> "Email")

__公告

This is my Blog

 __目录

  1. 1. hexo d 报 Error: Spawn failed

* 解决cmd中运行Hexo报错hexo : 无法加载文件hexo.ps1，因为在此系统上禁止运行脚本

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
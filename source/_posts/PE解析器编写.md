---
title: "PE解析器编写"
date: 2024-10-25 19:29:28
tags: ["reverse"]
categories: []
---

项目地址  
[pe-parse/ at master · helsome/pe-parse (github.com)](<https://github.com/helsome/pe-parse/tree/master>)

理论部分见令一篇文章：PE结构浅析。

# 源码
    
    
    // dllmain.cpp : 定义 DLL 应用程序的入口点。
    #include<iostream>
    #include<windows.h>
    
    /*运行前需要为项目赋予admin权限，点击项目右键->属性->配置属性->链接器->清单文件->UAC执行级别->requireAdministrator（选择）。 这样生成的程序在运行时就可以获得管理员权限，向C盘写入文件
    否则szBuffer会为NULL，无法运行*/
    //文件加载函数
    char* LoadFile(const char* szFilePath)
    {
    	//打开文件
    	HANDLE hFile = CreateFileA(szFilePath, GENERIC_READ | GENERIC_WRITE, NULL, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    	if (hFile == INVALID_HANDLE_VALUE)//判断文件是否正确打开
    		return NULL;
    	DWORD dwFileSize = GetFileSize(hFile, NULL);
    	char* szBuffer = new char [dwFileSize] {0};
    	DWORD dwReadSize = 0;
    	BOOL bRet = ReadFile(hFile, szBuffer, dwFileSize, &dwFileSize, NULL);//lpbuffer指向接收从文件或设备读取的数据的缓冲区的指针。
    	if (bRet)
    		return szBuffer;
    	else
    		return 0;
    }
    DWORD RvaToFoa(DWORD dwRva, char* szBuffer)//计算地址偏移量
    {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    	PIMAGE_SECTION_HEADER pSectionHeader = IMAGE_FIRST_SECTION(pNt);
    	if (dwRva<pSectionHeader[0].VirtualAddress)//判断此时rva是否在头部
    	{
    		return dwRva;
    	}
    	for (size_t i = 0; i < pNt->FileHeader.NumberOfSections; i++)
    	{
    		if (dwRva >= pSectionHeader[i].VirtualAddress && dwRva <= pSectionHeader[i].VirtualAddress + pSectionHeader[i].Misc.VirtualSize)//判断位置
    		{
    			return dwRva - pSectionHeader[i].VirtualAddress + pSectionHeader[i].PointerToRawData;//返回偏移量
    		}
    	}
    }
    bool CheckPEFormat(char* szBuffer) {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	if (pDos->e_magic != IMAGE_DOS_SIGNATURE) {
    		return false; // Not a valid PE file
    	}
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    	return pNt->Signature == IMAGE_NT_SIGNATURE; // Check PE signature
    }
    void ReadFileHeader(char* szBuffer) {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    	PIMAGE_FILE_HEADER pFileHeader = &pNt->FileHeader;
    
    	printf("Machine: %04X\n", pFileHeader->Machine);
    	printf("Number of Sections: %04X\n", pFileHeader->NumberOfSections);
    	printf("Time Date Stamp: %08X\n", pFileHeader->TimeDateStamp);
    	printf("Characteristics: %04X\n", pFileHeader->Characteristics);
    }
    void ReadOptionalHeader(char* szBuffer) {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    	PIMAGE_OPTIONAL_HEADER pOptHeader = &pNt->OptionalHeader;
    
    	printf("Magic: %04X\n", pOptHeader->Magic);
    	printf("Image Base: %08X\n", pOptHeader->ImageBase);
    	printf("Section Alignment: %08X\n", pOptHeader->SectionAlignment);
    	//printf("Size of Optional Header: %04X\n", pFileHeader->SizeOfOptionalHeader);
    }
    void ReadDataDirectory(char* szBuffer) {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    
    	for (int i = 0; i < IMAGE_NUMBEROF_DIRECTORY_ENTRIES; i++) {
    		PIMAGE_DATA_DIRECTORY pDir = &pNt->OptionalHeader.DataDirectory[i];
    		printf("Data Directory %d: VA = %08X, Size = %08X\n", i, pDir->VirtualAddress, pDir->Size);
    	}
    }
    void ReadSectionTable(char* szBuffer) {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    	PIMAGE_SECTION_HEADER pSectionHeader = IMAGE_FIRST_SECTION(pNt);
    
    	for (int i = 0; i < pNt->FileHeader.NumberOfSections; i++) {
    		printf("Section Name: %.8s\n", pSectionHeader[i].Name);
    		printf("Virtual Size: %08X\n", pSectionHeader[i].Misc.VirtualSize);
    		printf("Virtual Address: %08X\n", pSectionHeader[i].VirtualAddress);
    		printf("Size of Raw Data: %08X\n", pSectionHeader[i].SizeOfRawData);
    		pSectionHeader++;
    	}
    }
    
    
    //解析导入表
    void ImportTable(char* szBuffer)
    {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    	//定位导入表
    	PIMAGE_OPTIONAL_HEADER pOptionHeader = &pNt->OptionalHeader;
    	PIMAGE_DATA_DIRECTORY pImportDir = pOptionHeader->DataDirectory + IMAGE_DIRECTORY_ENTRY_IMPORT;
    	//填入导出表
    	PIMAGE_IMPORT_DESCRIPTOR pImport = (PIMAGE_IMPORT_DESCRIPTOR)(RvaToFoa(pImportDir->VirtualAddress, szBuffer) + szBuffer);//Rvatofoa计算导入表的头到文件头的距离
    	while(pImport->Name!= NULL)
    	{
    		char* szModuleName = (char*)(RvaToFoa(pImport->Name, szBuffer) + szBuffer);
    		printf("DLL名称：%s\r\n", szModuleName);
    		printf("时间日期标志\r\n", pImport->TimeDateStamp);
    		printf("ForwarderChain%08X\r\n", pImport->ForwarderChain);
    		printf("NameRva;%08X\r\n", pImport->Name);
    		printf("OriginalFirstThunk;%08X\r\n", pImport->OriginalFirstThunk);
    		printf("FirstThunk;%08X\r\n", pImport->FirstThunk);
    		//指向导入地址表的RVA
    		PIMAGE_THUNK_DATA pIAT = (PIMAGE_THUNK_DATA)(RvaToFoa(pImport->FirstThunk, szBuffer) + szBuffer);//IAT导入地址表
    		DWORD dwIndex = 0;
    		DWORD dwImportOffset = 0;
    		//被导入函数序号
    		while (pIAT->u1.Ordinal)
    		{
    			printf("ThunkRVA:08X\r\n", pImport->OriginalFirstThunk + dwIndex);
    			dwImportOffset = RvaToFoa(pImport->OriginalFirstThunk, szBuffer);
    			printf("ThunkFOA:08X\r\n", dwImportOffset + dwIndex);
    			dwIndex += 4;
    			if ((pIAT->u1.Ordinal && 0x80000000) != 1)
    			{
    				PIMAGE_IMPORT_BY_NAME pName = (PIMAGE_IMPORT_BY_NAME)(RvaToFoa(RvaToFoa(pIAT->u1.AddressOfData, szBuffer), szBuffer));
    				printf("API name:%s\n", pName->Name);
    				printf("Hint:%04X\n", pName->Hint);
    				//被导入函数的地址
    				printf("ThunkValue:%08X\n",pIAT->u1.Function);
    			}
    			pIAT++;
    		}
    		pImport++;
    	}
    }
    void TSLTable(char* szBuffer)
    {
    	PIMAGE_DOS_HEADER pDos = (PIMAGE_DOS_HEADER)szBuffer;
    	PIMAGE_NT_HEADERS pNt = (PIMAGE_NT_HEADERS)(szBuffer + pDos->e_lfanew);
    	//定位TSL表
    	PIMAGE_DATA_DIRECTORY pTSLDir = (pNt->OptionalHeader.DataDirectory + IMAGE_DIRECTORY_ENTRY_TLS);
    	//填充TLS结构
    	PIMAGE_TLS_DIRECTORY pTLS = (PIMAGE_TLS_DIRECTORY)(RvaToFoa(pTSLDir->VirtualAddress, szBuffer) + szBuffer);
    	printf("数据块开始VA：%08X\n",pTLS->StartAddressOfRawData);
    	printf("数据块结束VA：%08X\n",pTLS->EndAddressOfRawData);
    	printf("索引变量VA：%08X\n", pTLS->AddressOfIndex);
    	printf("特征值：%08X\n", pTLS->Characteristics);
    }
    int main()
    {
    	char* szBuffer = LoadFile("C:\\Users\\helse\\Desktop\\artifact2.exe");
    	if (CheckPEFormat(szBuffer)) 
    	{
    		ReadFileHeader(szBuffer);
    		ReadOptionalHeader(szBuffer);
    		ReadDataDirectory(szBuffer);
    		ReadSectionTable(szBuffer);
    		ImportTable(szBuffer);
    		TSLTable(szBuffer);
    	}
    	else {
    		printf("Not a valid PE file.\n");
    	}
    	system("pause");
    	return 0;
    }

# 结果对比

![](/./../pic/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/7ca3c4665ebf5dd590c029f509fd4feb-1729855855404-1.png)

![](/./../pic/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/19b1c6f5291e081049cfd64e16e2bbe1-1729855858938-3.png)

![](/./../pic/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/6335362bc7b0781a9ea65c5bb99db124-1729855862525-5.png)  
![](/./../pic/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/e505657c42915c16b18f6c2f71df4696-1729855865115-7.png)

![](/./../pic/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/39557012cc74af22ac728a3fb3a5c24f-1729855868037-9.png)  
![](/./../pic/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/7e8e0c7b64c9928fcae67b3a4afbb796-1729855870530-11.png)

__文章作者:[helson](<https://helsome.gihub.io>)

 __文章链接:<https://helsome.gihub.io/2024/10/25/PE%E8%A7%A3%E6%9E%90%E5%99%A8%E7%BC%96%E5%86%99/>

__版权声明: 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](<https://creativecommons.org/licenses/by-nc-sa/4.0/>) 许可协议。转载请注明来自 [infinite](<https://helsome.gihub.io>)！

[reverse](</tags/reverse/>)

[上一篇brute ratel C4 badger全分析文档](</2024/10/25/brute-ratel-C4-badger%E5%85%A8%E5%88%86%E6%9E%90%E6%96%87%E6%A1%A3/> "brute ratel C4 badger全分析文档")

[下一篇利用dll通知回调加载shellcode](</2024/10/25/%E5%88%A9%E7%94%A8dll%E9%80%9A%E7%9F%A5%E5%9B%9E%E8%B0%83%E5%8A%A0%E8%BD%BDshellcode/> "利用dll通知回调加载shellcode")

 __相关推荐

[ __2024-04-28 CobaltStrike UPX脱壳加壳](</2024/04/28/CobaltStrike-UPX%E8%84%B1%E5%A3%B3%E5%8A%A0%E5%A3%B3/> "CobaltStrike UPX脱壳加壳")

[ __2024-01-17 PE文件浅析](</2024/01/17/PE%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84%EF%BC%88%E8%87%AA%E7%94%A8%EF%BC%89/> "PE文件浅析")

[ __2024-04-28 dll injection（dll注入）](</2024/04/28/dll%E6%B3%A8%E5%85%A5%E6%8A%80%E6%9C%AF/> "dll injection（dll注入）")

[ __2024-04-28 go语言样本逆向分析特点](</2024/04/28/go%E8%AF%AD%E8%A8%80%E6%A0%B7%E6%9C%AC-%E9%80%86%E5%90%91%E5%88%86%E6%9E%90%E7%89%B9%E7%82%B9/> "go语言样本逆向分析特点")

[ __2024-07-08 wannacry勒索病毒加密解密过程分析](</2024/07/08/wannacry/> "wannacry勒索病毒加密解密过程分析")

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

  1. 1. 源码
  2. 2. 结果对比

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
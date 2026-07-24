#!/usr/bin/env node
// ==============================================
// CRX3 打包脚本
// 从预打包的 zip + 私钥生成 Chrome 扩展 .crx 文件
// 用法: node deployment/pack-crx.cjs <zip_path> <key_path> <crx_output>
// ==============================================

'use strict';

var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

var args = process.argv.slice(2);
if (args.length < 3) {
    console.error('用法: node pack-crx.cjs <zip_path> <key_path> <crx_output>');
    process.exit(1);
}

var zipPath = args[0];
var keyPath = args[1];
var crxPath = args[2];

var zipContent = fs.readFileSync(zipPath);
var keyPem = fs.readFileSync(keyPath, 'utf-8');

// 从 PEM 中提取公私钥
var privateKey = crypto.createPrivateKey(keyPem);
var publicKey = crypto.createPublicKey(privateKey);

// 获取 DER 格式公钥
var publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });

// 计算 CRX ID（公钥 SHA256 的前 128 位）
var crxId = crypto.createHash('sha256').update(publicKeyDer).digest().slice(0, 16);

// ========== Protobuf 编码工具函数 ==========

function encodeVarint(value) {
    var bytes = [];
    while (value > 127) {
        bytes.push((value & 0x7f) | 0x80);
        value >>>= 7;
    }
    bytes.push(value & 0x7f);
    return Buffer.from(bytes);
}

function encodeLengthDelimited(fieldNum, data) {
    return Buffer.concat([
        encodeVarint((fieldNum << 3) | 2),
        encodeVarint(data.length),
        data
    ]);
}

// ========== 构建 SignedData protobuf ==========

var signedData = encodeLengthDelimited(1, crxId);

// ========== 构建待签名数据 ==========
// 签名覆盖: "CRX3 SignedData\x00" + signed_header_size (4B LE) + signed_header_data + archive
var signedHeaderSize = Buffer.alloc(4);
signedHeaderSize.writeUInt32LE(signedData.length, 0);

var signaturePayload = Buffer.concat([
    Buffer.from('CRX3 SignedData\x00', 'utf-8'),
    signedHeaderSize,
    signedData,
    zipContent
]);

// ========== 签名 ==========

var sign = crypto.createSign('SHA256');
sign.update(signaturePayload);
sign.end();
var signature = sign.sign(privateKey);

// ========== 构建 AsymmetricKeyProof ==========

var keyProofInner = Buffer.concat([
    encodeLengthDelimited(1, publicKeyDer),
    encodeLengthDelimited(2, signature)
]);

// ========== 构建 CrxFileHeader ==========

var sha256WithRsa = encodeLengthDelimited(2, keyProofInner);
var signedHeaderDataField = encodeLengthDelimited(10000, signedData);
var header = Buffer.concat([sha256WithRsa, signedHeaderDataField]);

// ========== 写入 CRX 文件 ==========

var headerBuf = header;
var headerLen = headerBuf.length;

var crxBuf = Buffer.alloc(12 + headerLen + zipContent.length);
var offset = 0;

// Magic: "Cr24"
crxBuf.write('Cr24', offset, 4, 'ascii');
offset += 4;

// Version: 3 (uint32 LE)
crxBuf.writeUInt32LE(3, offset);
offset += 4;

// Header length (uint32 LE)
crxBuf.writeUInt32LE(headerLen, offset);
offset += 4;

// Header
headerBuf.copy(crxBuf, offset);
offset += headerLen;

// ZIP content
zipContent.copy(crxBuf, offset);

fs.writeFileSync(crxPath, crxBuf);
console.log('[INFO] CRX 打包完成: ' + crxPath);
console.log('[INFO] CRX ID: ' + crxId.toString('hex'));
console.log('[INFO] 文件大小: ' + (crxBuf.length / 1024).toFixed(1) + 'K');

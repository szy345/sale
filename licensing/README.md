# 授权签发工具

此目录只在厂商/开发电脑使用，**不要打包给商户**。

## 初始化密钥

```bash
node licensing/generate-keypair.mjs
```

会生成：

- `licensing/private-key.pem`：私钥，必须单独备份，不能提交代码仓库
- `server/license-public.pem`：公钥，随系统发布

私钥丢失后无法再签发新授权。

## 获取机器码

在需要授权的 Windows 电脑上，于项目根目录执行：

```bash
node licensing/machine-code.mjs
```

得到类似：

```text
A1B2-C3D4-E5F6-G7H8
```

## 签发授权

永久授权：

```bash
node licensing/issue-license.mjs \
  --machine A1B2-C3D4-E5F6-G7H8 \
  --merchant "某某鞋店" \
  --type paid \
  --out licensing/issued/某某鞋店.lic
```

按年授权：

```bash
node licensing/issue-license.mjs \
  --machine A1B2-C3D4-E5F6-G7H8 \
  --merchant "某某鞋店" \
  --type paid \
  --expires 2027-10-21 \
  --out licensing/issued/某某鞋店.lic
```

把生成的 `.lic` 文件发给商户，由管理员在“授权信息”页面导入。

## 现有商户

现有商户升级到授权版本前，建议先为其生成正式授权文件，升级后立即导入，避免进入试用或锁定。

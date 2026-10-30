# Changelog

## [0.23.3](https://github.com/echovisionlab/geul-web/compare/v0.23.2...v0.23.3) (2026-10-30)


### Bug Fixes

* **auth:** handle a lost session once in the server API client ([#214](https://github.com/echovisionlab/geul-web/issues/214)) ([05d380a](https://github.com/echovisionlab/geul-web/commit/05d380a2663d19e454755879584a51d2ba643695))

## [0.23.2](https://github.com/echovisionlab/geul-web/compare/v0.23.1...v0.23.2) (2026-10-30)


### Bug Fixes

* **auth:** notice a lost session promptly and leave signed-in areas ([#212](https://github.com/echovisionlab/geul-web/issues/212)) ([3be9c0b](https://github.com/echovisionlab/geul-web/commit/3be9c0bbb0e1c6fc8dbb5253905937f4d202f5a6))

## [0.23.1](https://github.com/echovisionlab/geul-web/compare/v0.23.0...v0.23.1) (2026-10-29)


### Bug Fixes

* **auth:** clear a stale pending email before starting a new verification ([#210](https://github.com/echovisionlab/geul-web/issues/210)) ([f958000](https://github.com/echovisionlab/geul-web/commit/f9580009289fda835d1509f6d9d07f387faaf149))

## [0.23.0](https://github.com/echovisionlab/geul-web/compare/v0.22.3...v0.23.0) (2026-10-29)


### Features

* **ui:** add SaveButton in the site color and use it for every save action ([#208](https://github.com/echovisionlab/geul-web/issues/208)) ([73642e5](https://github.com/echovisionlab/geul-web/commit/73642e59f94f79eeb78dabdda9ec1cfa893737ef))

## [0.22.3](https://github.com/echovisionlab/geul-web/compare/v0.22.2...v0.22.3) (2026-10-29)


### Bug Fixes

* hide the company line when the site sets no company name ([#206](https://github.com/echovisionlab/geul-web/issues/206)) ([001f954](https://github.com/echovisionlab/geul-web/commit/001f954c1d0ff8d3cd964b20c612cb4dbbce0b19))

## [0.22.2](https://github.com/echovisionlab/geul-web/compare/v0.22.1...v0.22.2) (2026-10-28)


### Bug Fixes

* **deps:** refresh dependencies and patch webpack-dev-middleware ([#203](https://github.com/echovisionlab/geul-web/issues/203)) ([98e5aa9](https://github.com/echovisionlab/geul-web/commit/98e5aa9360ebb97ff1077180f044013317561b3a))

## [0.22.1](https://github.com/echovisionlab/geul-web/compare/v0.22.0...v0.22.1) (2026-10-27)


### Bug Fixes

* MCP grant revoke, local backups, placeholder nicknames and security updates ([#201](https://github.com/echovisionlab/geul-web/issues/201)) ([44c630f](https://github.com/echovisionlab/geul-web/commit/44c630f7a89e43bc490e12084304aa8488ded790))

## [0.22.0](https://github.com/echovisionlab/geul-web/compare/v0.21.5...v0.22.0) (2026-10-27)


### Features

* size site logos by their files and stop repeating the search hint ([#199](https://github.com/echovisionlab/geul-web/issues/199)) ([6a535a6](https://github.com/echovisionlab/geul-web/commit/6a535a61f21ae5b6fafb60cc340752ada80e3f6b))

## [0.21.5](https://github.com/echovisionlab/geul-web/compare/v0.21.4...v0.21.5) (2026-10-26)


### Bug Fixes

* apply shared controls to video start button ([#197](https://github.com/echovisionlab/geul-web/issues/197)) ([4d9ba16](https://github.com/echovisionlab/geul-web/commit/4d9ba167e7506e5a4a639b59c0edb9c5bdcdfa87))

## [0.21.4](https://github.com/echovisionlab/geul-web/compare/v0.21.3...v0.21.4) (2026-10-26)


### Bug Fixes

* fill embedded map width and use shared startup error page ([#195](https://github.com/echovisionlab/geul-web/issues/195)) ([dd6e52c](https://github.com/echovisionlab/geul-web/commit/dd6e52c239c485983e28d541fb5d1535dbd80120))

## [0.21.3](https://github.com/echovisionlab/geul-web/compare/v0.21.2...v0.21.3) (2026-10-23)


### Miscellaneous Chores

* release 0.21.3 ([#193](https://github.com/echovisionlab/geul-web/issues/193)) ([7b207c4](https://github.com/echovisionlab/geul-web/commit/7b207c4ed753c37b0b2ad814f84c09f123c20beb))

## [0.21.2](https://github.com/echovisionlab/geul-web/compare/v0.21.1...v0.21.2) (2026-10-23)


### Bug Fixes

* recover File manager detail and deletion checks when a request fails ([#180](https://github.com/echovisionlab/geul-web/issues/180)) ([d272059](https://github.com/echovisionlab/geul-web/commit/d272059fb00dc54561458c77c887634eabd65f0f))

## [0.21.1](https://github.com/echovisionlab/geul-web/compare/v0.21.0...v0.21.1) (2026-10-22)


### Bug Fixes

* **auth:** return operator sign-ins to native Hydra endpoints ([#186](https://github.com/echovisionlab/geul-web/issues/186)) ([b462beb](https://github.com/echovisionlab/geul-web/commit/b462beb263478773c72e0959623e81facbbcb95c))

## [0.21.0](https://github.com/echovisionlab/geul-web/compare/v0.20.4...v0.21.0) (2026-10-22)


### Features

* **auth:** sign rawsector Admins in to operator tools through Hydra ([#185](https://github.com/echovisionlab/geul-web/issues/185)) ([4606363](https://github.com/echovisionlab/geul-web/commit/4606363f5851e0ed1cdc924aac5508c9fbc15ad5))


### Bug Fixes

* stop re-requesting Work client details that cannot be read ([#179](https://github.com/echovisionlab/geul-web/issues/179)) ([bd364a3](https://github.com/echovisionlab/geul-web/commit/bd364a348b21597cead8bac0f6e660cc50e9da94))

## [0.20.4](https://github.com/echovisionlab/geul-web/compare/v0.20.3...v0.20.4) (2026-10-22)


### Bug Fixes

* hide download actions a File's policy does not grant ([#175](https://github.com/echovisionlab/geul-web/issues/175)) ([7bc603e](https://github.com/echovisionlab/geul-web/commit/7bc603e2dfd21276299551181be28dbdce5959b8))

## [0.20.3](https://github.com/echovisionlab/geul-web/compare/v0.20.2...v0.20.3) (2026-10-22)


### Bug Fixes

* **editor:** keep snapshot images in place when the live editor takes over ([#173](https://github.com/echovisionlab/geul-web/issues/173)) ([dc06e45](https://github.com/echovisionlab/geul-web/commit/dc06e457b545084118031466c6ae684c361f0d34))

## [0.20.2](https://github.com/echovisionlab/geul-web/compare/v0.20.1...v0.20.2) (2026-10-21)


### Bug Fixes

* open File settings below its menu instead of inside the toolbar ([#171](https://github.com/echovisionlab/geul-web/issues/171)) ([4cb76b0](https://github.com/echovisionlab/geul-web/commit/4cb76b0159a0009aea478e0d0d9182815901cc21))

## [0.20.1](https://github.com/echovisionlab/geul-web/compare/v0.20.0...v0.20.1) (2026-10-21)


### Bug Fixes

* keep File block controls in its menu above the block ([#169](https://github.com/echovisionlab/geul-web/issues/169)) ([d0166b7](https://github.com/echovisionlab/geul-web/commit/d0166b76d3c12f2a894e81e19f6f0ad154b84724))

## [0.20.0](https://github.com/echovisionlab/geul-web/compare/v0.19.0...v0.20.0) (2026-10-21)


### Features

* size blocks with XS–XL presets and keep tall media on screen ([#168](https://github.com/echovisionlab/geul-web/issues/168)) ([9298331](https://github.com/echovisionlab/geul-web/commit/92983315dcdee2329f7823134cefedd996490879))


### Bug Fixes

* keep the editor updating when an image block is selected ([#166](https://github.com/echovisionlab/geul-web/issues/166)) ([4dbccfb](https://github.com/echovisionlab/geul-web/commit/4dbccfbbd2e3e33800290b66ac3cd8a6a4aa3005))

## [0.19.0](https://github.com/echovisionlab/geul-web/compare/v0.18.2...v0.19.0) (2026-10-21)


### Features

* import images from pasted Markdown and export images as images ([#162](https://github.com/echovisionlab/geul-web/issues/162)) ([d8b5374](https://github.com/echovisionlab/geul-web/commit/d8b5374090bcd0a3b71e6ed191deb61c42f807df))
* present standalone links as cards or videos and gate players on consent ([#165](https://github.com/echovisionlab/geul-web/issues/165)) ([2889835](https://github.com/echovisionlab/geul-web/commit/28898359bb865e5df1ca9f97c0ad0f21fd89fc0d))


### Bug Fixes

* **deps:** update dependencies, toolchain and shared contracts to latest ([#164](https://github.com/echovisionlab/geul-web/issues/164)) ([a77ebb0](https://github.com/echovisionlab/geul-web/commit/a77ebb0fc4dc966e9f3ea52250e4d6a4d7f9cbad))

## [0.18.2](https://github.com/echovisionlab/geul-web/compare/v0.18.1...v0.18.2) (2026-10-20)


### Bug Fixes

* phone navigation and quieter public pages ([#160](https://github.com/echovisionlab/geul-web/issues/160)) ([c041c4c](https://github.com/echovisionlab/geul-web/commit/c041c4c05de241b4b2fd8490967fbd4a3aa848e2))

## [0.18.1](https://github.com/echovisionlab/geul-web/compare/v0.18.0...v0.18.1) (2026-10-20)


### Bug Fixes

* stop logging an absent latest OG generation as a failure ([#158](https://github.com/echovisionlab/geul-web/issues/158)) ([674db8b](https://github.com/echovisionlab/geul-web/commit/674db8b92daf0d36ffd23d1f8d8286cb506c07d9))

## [0.18.0](https://github.com/echovisionlab/geul-web/compare/v0.17.2...v0.18.0) (2026-10-19)


### Features

* use the outline rail at every width ([f81297c](https://github.com/echovisionlab/geul-web/commit/f81297ca1e2483ea43e7d79e570ba7b7221c3268))


### Bug Fixes

* tell readers in their language when a document is shown in another one ([b709b1f](https://github.com/echovisionlab/geul-web/commit/b709b1fe050bd717b7cf5ce8f5f351db590d9109))

## [0.17.2](https://github.com/echovisionlab/geul-web/compare/v0.17.1...v0.17.2) (2026-10-19)


### Bug Fixes

* legal titles in the content language and a cleaner outline rail ([#153](https://github.com/echovisionlab/geul-web/issues/153)) ([85088dc](https://github.com/echovisionlab/geul-web/commit/85088dcf4bdcb5272df20bce78cb94fbcb38794e))

## [0.17.1](https://github.com/echovisionlab/geul-web/compare/v0.17.0...v0.17.1) (2026-10-19)


### Bug Fixes

* trim explanatory copy in the member area ([#151](https://github.com/echovisionlab/geul-web/issues/151)) ([ec65af3](https://github.com/echovisionlab/geul-web/commit/ec65af3bdd56588cc0c476f3d7b4db1ebf1191a9))

## [0.17.0](https://github.com/echovisionlab/geul-web/compare/v0.16.1...v0.17.0) (2026-10-18)


### Features

* calm design system, Geul font system and entity detail layout ([#149](https://github.com/echovisionlab/geul-web/issues/149)) ([9c41c26](https://github.com/echovisionlab/geul-web/commit/9c41c2649aaaeb256a7145fcee78c69435ccb773))

## [0.16.1](https://github.com/echovisionlab/geul-web/compare/v0.16.0...v0.16.1) (2026-10-18)


### Bug Fixes

* trust direct tool subdomains for embeds ([#147](https://github.com/echovisionlab/geul-web/issues/147)) ([0482686](https://github.com/echovisionlab/geul-web/commit/04826867d41f21a48f2344d4f69ae533a6fb23a1))

## [0.16.0](https://github.com/echovisionlab/geul-web/compare/v0.15.0...v0.16.0) (2026-10-18)


### Features

* five collection sizes, start-edge documents and a shared hover ink ([#145](https://github.com/echovisionlab/geul-web/issues/145)) ([f0c0edb](https://github.com/echovisionlab/geul-web/commit/f0c0edbb6db65dab6fe8484388eedef006bde9dd))

## [0.15.0](https://github.com/echovisionlab/geul-web/compare/v0.14.3...v0.15.0) (2026-10-17)


### ⚠ BREAKING CHANGES

* site logo slots, settings hierarchy and balanced site header ([#143](https://github.com/echovisionlab/geul-web/issues/143))

### Features

* site logo slots, settings hierarchy and balanced site header ([#143](https://github.com/echovisionlab/geul-web/issues/143)) ([8f81100](https://github.com/echovisionlab/geul-web/commit/8f81100b20033135e9732f111d006e27404339b7))

## [0.14.3](https://github.com/echovisionlab/geul-web/compare/v0.14.2...v0.14.3) (2026-10-17)


### Bug Fixes

* stabilize editor configuration and preserve response metadata ([#141](https://github.com/echovisionlab/geul-web/issues/141)) ([b80d712](https://github.com/echovisionlab/geul-web/commit/b80d712da4af4657d053821ecdb38d7a05b80c48))

## [0.14.2](https://github.com/echovisionlab/geul-web/compare/v0.14.1...v0.14.2) (2026-10-16)


### Bug Fixes

* align contact settings, email previews and parallel tests ([#136](https://github.com/echovisionlab/geul-web/issues/136)) ([e192bad](https://github.com/echovisionlab/geul-web/commit/e192badb2521fe636c89d9e7ea0ed2a809987dc2))
* preserve email line breaks and isolate editor policies and test projects ([#137](https://github.com/echovisionlab/geul-web/issues/137)) ([abf3b7a](https://github.com/echovisionlab/geul-web/commit/abf3b7ad2ca2b396824576f281c105db2b77ed07))

## [0.14.1](https://github.com/echovisionlab/geul-web/compare/v0.14.0...v0.14.1) (2026-10-16)


### Bug Fixes

* map height, font cache, and responsive site logo ([#134](https://github.com/echovisionlab/geul-web/issues/134)) ([17eb8af](https://github.com/echovisionlab/geul-web/commit/17eb8afacf5d2dc68c62f24e7b3829f8af5b0e03))

## [0.14.0](https://github.com/echovisionlab/geul-web/compare/v0.13.0...v0.14.0) (2026-10-16)


### Features

* site variables for brand and contact values ([#127](https://github.com/echovisionlab/geul-web/issues/127)) ([5238ad9](https://github.com/echovisionlab/geul-web/commit/5238ad91f0a3b24e62c7072d1f5b3d1a65e376d0))


### Bug Fixes

* **logging:** log failure causes on web server paths ([#132](https://github.com/echovisionlab/geul-web/issues/132)) ([0b23dfe](https://github.com/echovisionlab/geul-web/commit/0b23dfe26a2cdbccb7b3fc834becc09f11434a16))

## [0.13.0](https://github.com/echovisionlab/geul-web/compare/v0.12.0...v0.13.0) (2026-10-15)


### Features

* Core design system and durable, Notion-like collaborative editing ([#124](https://github.com/echovisionlab/geul-web/issues/124)) ([846267c](https://github.com/echovisionlab/geul-web/commit/846267c4fd836db8f7a5dc01a8ddf7cdede3959d))

## [0.12.0](https://github.com/echovisionlab/geul-web/compare/v0.11.2...v0.12.0) (2026-10-09)


### Features

* **policy:** allow editing and deleting every policy lifecycle ([#121](https://github.com/echovisionlab/geul-web/issues/121)) ([1a8302e](https://github.com/echovisionlab/geul-web/commit/1a8302e10e205a866319120eb0f97841cfe8a964))

## [0.11.2](https://github.com/echovisionlab/geul-web/compare/v0.11.1...v0.11.2) (2026-10-08)


### Bug Fixes

* preserve query failures and editor state ([#118](https://github.com/echovisionlab/geul-web/issues/118)) ([fdf827a](https://github.com/echovisionlab/geul-web/commit/fdf827a5ef985f8f446fa6b5f1c61464e438e766))
* preserve server action read failures ([#120](https://github.com/echovisionlab/geul-web/issues/120)) ([e620ae6](https://github.com/echovisionlab/geul-web/commit/e620ae656b3f1d3daad4d2a8749ea9e125c63f40))

## [0.11.1](https://github.com/echovisionlab/geul-web/compare/v0.11.0...v0.11.1) (2026-10-08)


### Bug Fixes

* preserve HTTP failure categories at web API boundaries ([#116](https://github.com/echovisionlab/geul-web/issues/116)) ([fd61817](https://github.com/echovisionlab/geul-web/commit/fd61817bd13be2a67d6805f910764b66bd190d4d))

## [0.11.0](https://github.com/echovisionlab/geul-web/compare/v0.10.5...v0.11.0) (2026-10-08)


### Features

* **ui:** unify error pages with Ionian particles and shared Three CDN runtime ([#114](https://github.com/echovisionlab/geul-web/issues/114)) ([69863e6](https://github.com/echovisionlab/geul-web/commit/69863e6c6c09cbda5f47f82da4d5e5f55fbe82a5))

## [0.10.5](https://github.com/echovisionlab/geul-web/compare/v0.10.4...v0.10.5) (2026-10-08)


### Bug Fixes

* **ui:** center error pages and preview recovery states in Storybook ([#112](https://github.com/echovisionlab/geul-web/issues/112)) ([2cb7c1e](https://github.com/echovisionlab/geul-web/commit/2cb7c1ef9d84baac91d06704a3f1ba1cb2032b58))

## [0.10.4](https://github.com/echovisionlab/geul-web/compare/v0.10.3...v0.10.4) (2026-10-06)


### Bug Fixes

* **fonts:** bypass cached font responses with missing CORS headers ([#110](https://github.com/echovisionlab/geul-web/issues/110)) ([d664363](https://github.com/echovisionlab/geul-web/commit/d664363943a2137f99d20463961f5616659663ee))

## [0.10.3](https://github.com/echovisionlab/geul-web/compare/v0.10.2...v0.10.3) (2026-10-06)


### Bug Fixes

* **images:** align crop, gallery and metadata aspect ratios ([#108](https://github.com/echovisionlab/geul-web/issues/108)) ([3e3c9a8](https://github.com/echovisionlab/geul-web/commit/3e3c9a8de0ada78971fb12300437d1cb74a21ea3))

## [0.10.2](https://github.com/echovisionlab/geul-web/compare/v0.10.1...v0.10.2) (2026-10-06)


### Bug Fixes

* **page:** restore language controls without a separate row ([cbcb89e](https://github.com/echovisionlab/geul-web/commit/cbcb89ec00ece69f54095bb748bb680c6693428d))
* **page:** restore language controls without a separate row ([61a3f08](https://github.com/echovisionlab/geul-web/commit/61a3f08349097281be47f738399a7ab2ac7edb0a))

## [0.10.1](https://github.com/echovisionlab/geul-web/compare/v0.10.0...v0.10.1) (2026-10-06)


### Bug Fixes

* **page:** keep content controls clear of embedded tools ([a144e64](https://github.com/echovisionlab/geul-web/commit/a144e642819ef5b7a91c5e76edcf879157d777ca))
* **page:** keep content controls clear of embedded tools ([e0fe310](https://github.com/echovisionlab/geul-web/commit/e0fe310ff8f84e38ffd6a1ca418038a76512c048))

## [0.10.0](https://github.com/echovisionlab/geul-web/compare/v0.9.2...v0.10.0) (2026-10-06)


### Features

* **embed:** run trusted tool modules directly in page blocks ([9620ac1](https://github.com/echovisionlab/geul-web/commit/9620ac16844155654ef812db69e4350a48dff703))
* **page:** embed independent tool modules and simplify content controls ([563c313](https://github.com/echovisionlab/geul-web/commit/563c3136692bf6769b1adeaca01977425ba1a9d8))


### Bug Fixes

* **content:** include language controls and banner cleanup ([b55d87e](https://github.com/echovisionlab/geul-web/commit/b55d87e3a76e7c014b55687ac277392296200f1f))
* **content:** simplify language controls and remove banners and share buttons ([141f532](https://github.com/echovisionlab/geul-web/commit/141f532b6f4b6bebe3649a268562196d3f621978))
* **embed:** initialize tools after their message listener is ready ([84ec2cd](https://github.com/echovisionlab/geul-web/commit/84ec2cdc3959e0c2e4f24c71fa82304ca6a96128))

## [0.9.2](https://github.com/echovisionlab/geul-web/compare/v0.9.1...v0.9.2) (2026-10-06)


### Bug Fixes

* **embed:** fit document height and simplify block UI ([54bfc7c](https://github.com/echovisionlab/geul-web/commit/54bfc7c7a96bc725968a4ddd788d32502a2d914a))
* **embed:** preserve long document content height ([b39c656](https://github.com/echovisionlab/geul-web/commit/b39c6565a832a7cb3de6539b0b1ef76ed616edbb))
* **embed:** remove extra frame toolbar ([b1ee121](https://github.com/echovisionlab/geul-web/commit/b1ee121839a00a0cab6d08b58c12e5bd32ef8e54))
* **embed:** remove unused Turkish toolbar strings ([f53bb2b](https://github.com/echovisionlab/geul-web/commit/f53bb2bb271254990b104ed45b10cd7373b52866))
* **embed:** simplify URL field label ([14688c9](https://github.com/echovisionlab/geul-web/commit/14688c907f6e5871dedbde887aa24298cfa839b6))

## [0.9.1](https://github.com/echovisionlab/geul-web/compare/v0.9.0...v0.9.1) (2026-10-06)


### Bug Fixes

* **build:** support pnpm 12 release containers ([6115c3d](https://github.com/echovisionlab/geul-web/commit/6115c3de6acb6da20610f3f76d53429cbba0547a))
* **build:** support pnpm 12 release containers ([680725a](https://github.com/echovisionlab/geul-web/commit/680725adb5162c7395743c8ca03bf8cf9d3a67a9))

## [0.9.0](https://github.com/echovisionlab/geul-web/compare/v0.8.1...v0.9.0) (2026-10-06)


### Features

* **page:** add runtime embeds and audience controls ([7a53499](https://github.com/echovisionlab/geul-web/commit/7a5349995bec56f799bde8ab1552f69e7a458ba1))
* **page:** add runtime embeds, audience controls and event credits ([af85791](https://github.com/echovisionlab/geul-web/commit/af85791e05c53d248022b148a7b59d2c05e0ccd6))


### Bug Fixes

* **test:** model current input and mock lifecycle semantics ([90057b4](https://github.com/echovisionlab/geul-web/commit/90057b4fd92658d3b45eb79731b13b909553e301))

## [0.8.1](https://github.com/echovisionlab/geul-web/compare/v0.8.0...v0.8.1) (2026-10-06)


### Bug Fixes

* **content:** keep summaries in previews and align event metadata ([#94](https://github.com/echovisionlab/geul-web/issues/94)) ([4e725a8](https://github.com/echovisionlab/geul-web/commit/4e725a84b85dfe6c7cfa468240a244b6c2e5a2c0))

## [0.8.0](https://github.com/echovisionlab/geul-web/compare/v0.7.2...v0.8.0) (2026-10-06)


### Features

* **tools:** add PortaDJ with site theme and localized metadata ([#92](https://github.com/echovisionlab/geul-web/issues/92)) ([daa6ca2](https://github.com/echovisionlab/geul-web/commit/daa6ca25a9ef21fec7792a9f617acc45f3571c08))

## [0.7.2](https://github.com/echovisionlab/geul-web/compare/v0.7.1...v0.7.2) (2026-10-05)


### Bug Fixes

* **hwp:** use rust-hwp-intl release with stable toolbox scrolling ([#90](https://github.com/echovisionlab/geul-web/issues/90)) ([10110d2](https://github.com/echovisionlab/geul-web/commit/10110d227fcf834b5171468c1764806d368f4bc6))

## [0.7.1](https://github.com/echovisionlab/geul-web/compare/v0.7.0...v0.7.1) (2026-10-05)


### Bug Fixes

* **deps:** upgrade Three and Ionian together ([623d78f](https://github.com/echovisionlab/geul-web/commit/623d78fdfde59b4d20d5e4e6683f7c2cacbdd841))
* **deps:** upgrade Three and Ionian together ([ccfbb09](https://github.com/echovisionlab/geul-web/commit/ccfbb09b32140f1a63820512f63eccb72d662d55))
* restrict Three diagnostics to development ([e3ba603](https://github.com/echovisionlab/geul-web/commit/e3ba603e42f32397709d061a5800d2e9a461c9d7))
* restrict Three diagnostics to development ([2dd8b99](https://github.com/echovisionlab/geul-web/commit/2dd8b99999858a2f32f5e120708084c47d95881b))

## [0.7.0](https://github.com/echovisionlab/geul-web/compare/v0.6.0...v0.7.0) (2026-10-05)


### Features

* process URL imports in the browser and retry slow uploads ([#84](https://github.com/echovisionlab/geul-web/issues/84)) ([ccf03b7](https://github.com/echovisionlab/geul-web/commit/ccf03b7c625959e4420b5389711ca49ae7703230))

## [0.6.0](https://github.com/echovisionlab/geul-web/compare/v0.5.1...v0.6.0) (2026-10-05)


### Features

* **tools:** add local HWP editor with shared UI and page scrolling ([#82](https://github.com/echovisionlab/geul-web/issues/82)) ([64cbd14](https://github.com/echovisionlab/geul-web/commit/64cbd14998c5f97eec537ae60a589778290d134b))

## [0.5.1](https://github.com/echovisionlab/geul-web/compare/v0.5.0...v0.5.1) (2026-10-05)


### Bug Fixes

* **slug:** restore title autofill and debounce availability checks ([#80](https://github.com/echovisionlab/geul-web/issues/80)) ([2308df9](https://github.com/echovisionlab/geul-web/commit/2308df9ed4b538e049f29dc10b42b25f97dd3377))

## [0.5.0](https://github.com/echovisionlab/geul-web/compare/v0.4.9...v0.5.0) (2026-10-04)


### Features

* prepare audio and video uploads in the browser ([ce4e09d](https://github.com/echovisionlab/geul-web/commit/ce4e09d8f503f489cab80420f999320fbd6ee993))

## [0.4.9](https://github.com/echovisionlab/geul-web/compare/v0.4.8...v0.4.9) (2026-10-04)


### Bug Fixes

* **ui:** remove print buttons from page and post views ([#76](https://github.com/echovisionlab/geul-web/issues/76)) ([dc25f2d](https://github.com/echovisionlab/geul-web/commit/dc25f2d2fbf8df73123d4c162628d1768c95d862))

## [0.4.8](https://github.com/echovisionlab/geul-web/compare/v0.4.7...v0.4.8) (2026-10-04)


### Performance Improvements

* remove avoidable public document waits ([#74](https://github.com/echovisionlab/geul-web/issues/74)) ([19c9835](https://github.com/echovisionlab/geul-web/commit/19c98356d1abef7f998bd8aa186c3b88a19ea46a))

## [0.4.7](https://github.com/echovisionlab/geul-web/compare/v0.4.6...v0.4.7) (2026-10-04)


### Performance Improvements

* open search immediately and unify GIF page loading ([#72](https://github.com/echovisionlab/geul-web/issues/72)) ([4712f86](https://github.com/echovisionlab/geul-web/commit/4712f86abdaaff4b14083853b723ef16ce11ab4c))

## [0.4.6](https://github.com/echovisionlab/geul-web/compare/v0.4.5...v0.4.6) (2026-10-03)


### Performance Improvements

* defer unused carousel skeleton dependencies ([#70](https://github.com/echovisionlab/geul-web/issues/70)) ([12cd58b](https://github.com/echovisionlab/geul-web/commit/12cd58bd2ef53b6c5322873c52594ce1a22b0153))

## [0.4.5](https://github.com/echovisionlab/geul-web/compare/v0.4.4...v0.4.5) (2026-10-03)


### Performance Improvements

* keep page media descriptors off empty routes ([#68](https://github.com/echovisionlab/geul-web/issues/68)) ([04af72b](https://github.com/echovisionlab/geul-web/commit/04af72b0659d46ed80d958380da283b4f96117fc))

## [0.4.4](https://github.com/echovisionlab/geul-web/compare/v0.4.3...v0.4.4) (2026-10-03)


### Performance Improvements

* load public section runtimes only when rendered ([#66](https://github.com/echovisionlab/geul-web/issues/66)) ([ec1961e](https://github.com/echovisionlab/geul-web/commit/ec1961e850d9fdcea16d022159ff5f9d4a77dfad))

## [0.4.3](https://github.com/echovisionlab/geul-web/compare/v0.4.2...v0.4.3) (2026-10-03)


### Performance Improvements

* **web:** separate public shell helpers from validation runtimes ([#64](https://github.com/echovisionlab/geul-web/issues/64)) ([af919c0](https://github.com/echovisionlab/geul-web/commit/af919c048a56c2a95076df6126c7d270cc7ed668))

## [0.4.2](https://github.com/echovisionlab/geul-web/compare/v0.4.1...v0.4.2) (2026-10-03)


### Performance Improvements

* **web:** load page features and RPC clients at their usage boundaries ([#62](https://github.com/echovisionlab/geul-web/issues/62)) ([c3c6871](https://github.com/echovisionlab/geul-web/commit/c3c68718083b5aa45743d5631b8dd72de4f1fee8))

## [0.4.1](https://github.com/echovisionlab/geul-web/compare/v0.4.0...v0.4.1) (2026-10-03)


### Performance Improvements

* **web:** narrow client loading and public catalogues ([#60](https://github.com/echovisionlab/geul-web/issues/60)) ([42049eb](https://github.com/echovisionlab/geul-web/commit/42049eb22e774b92a911ce53118923bcce8ae611))

## [0.4.0](https://github.com/echovisionlab/geul-web/compare/v0.3.6...v0.4.0) (2026-10-03)


### Features

* **mcp:** add task examples and clarify connection consent ([#58](https://github.com/echovisionlab/geul-web/issues/58)) ([7fee034](https://github.com/echovisionlab/geul-web/commit/7fee034a63438533c19b5215922c1856b0a8d988))

## [0.3.6](https://github.com/echovisionlab/geul-web/compare/v0.3.5...v0.3.6) (2026-10-03)


### Bug Fixes

* **mcp:** render configured guide URLs and recover grant revocation ([#56](https://github.com/echovisionlab/geul-web/issues/56)) ([cc9f289](https://github.com/echovisionlab/geul-web/commit/cc9f2897341b15ad6784fa3aa77d51080cf3ad8a))

## [0.3.5](https://github.com/echovisionlab/geul-web/compare/v0.3.4...v0.3.5) (2026-10-02)


### Bug Fixes

* **web:** preserve Server Action identity across releases ([#54](https://github.com/echovisionlab/geul-web/issues/54)) ([8e95c17](https://github.com/echovisionlab/geul-web/commit/8e95c17127d410c4898599c7333bacf1c6d8ebf6))

## [0.3.4](https://github.com/echovisionlab/geul-web/compare/v0.3.3...v0.3.4) (2026-10-01)


### Bug Fixes

* **editor:** preserve translated metadata drafts on refresh ([#52](https://github.com/echovisionlab/geul-web/issues/52)) ([4acc222](https://github.com/echovisionlab/geul-web/commit/4acc222ff3c9d4dc0aca418a1a0fd566b2fda3c7))

## [0.3.3](https://github.com/echovisionlab/geul-web/compare/v0.3.2...v0.3.3) (2026-10-01)


### Bug Fixes

* **editor:** preserve recovery intent and durable lifecycle saves ([#50](https://github.com/echovisionlab/geul-web/issues/50)) ([83b82a3](https://github.com/echovisionlab/geul-web/commit/83b82a3bd695cdafc406e2a0e0df13f5cb840557))

## [0.3.2](https://github.com/echovisionlab/geul-web/compare/v0.3.1...v0.3.2) (2026-10-01)


### Bug Fixes

* acknowledge automatic editor saves ([#48](https://github.com/echovisionlab/geul-web/issues/48)) ([2d66502](https://github.com/echovisionlab/geul-web/commit/2d66502e0027d6b5a913d23d41b53cbacf6005c5))

## [0.3.1](https://github.com/echovisionlab/geul-web/compare/v0.3.0...v0.3.1) (2026-10-01)


### Bug Fixes

* clear editor unload guards after durable autosave ([#45](https://github.com/echovisionlab/geul-web/issues/45)) ([6c34072](https://github.com/echovisionlab/geul-web/commit/6c34072f3dd958df01623da1751e91d00e9404f5))

## [0.3.0](https://github.com/echovisionlab/geul-web/compare/v0.2.9...v0.3.0) (2026-10-01)


### ⚠ BREAKING CHANGES

* synchronize editor changes without manual recovery ([#43](https://github.com/echovisionlab/geul-web/issues/43))

### Bug Fixes

* synchronize editor changes without manual recovery ([#43](https://github.com/echovisionlab/geul-web/issues/43)) ([1d14e69](https://github.com/echovisionlab/geul-web/commit/1d14e69ae8ec28bf17493ebe898bc6a8c5942018))

## [0.2.9](https://github.com/echovisionlab/geul-web/compare/v0.2.8...v0.2.9) (2026-10-01)


### Bug Fixes

* **editor:** preserve versioned Post settings and defer map styles ([#41](https://github.com/echovisionlab/geul-web/issues/41)) ([fd728a0](https://github.com/echovisionlab/geul-web/commit/fd728a04a579dbe0bb20daa050bee2931f931042))

## [0.2.8](https://github.com/echovisionlab/geul-web/compare/v0.2.7...v0.2.8) (2026-10-01)


### Bug Fixes

* preserve editor saves and guard navigation through acknowledgements ([#39](https://github.com/echovisionlab/geul-web/issues/39)) ([bf25bd6](https://github.com/echovisionlab/geul-web/commit/bf25bd67855576730a96ae603882a06330016b75))

## [0.2.7](https://github.com/echovisionlab/geul-web/compare/v0.2.6...v0.2.7) (2026-10-01)


### Performance Improvements

* **map:** bundle worker dependencies into one module ([#37](https://github.com/echovisionlab/geul-web/issues/37)) ([3ac3ce7](https://github.com/echovisionlab/geul-web/commit/3ac3ce7232bdd3a3cb25d3d3ae9f0644348ba210))

## [0.2.6](https://github.com/echovisionlab/geul-web/compare/v0.2.5...v0.2.6) (2026-10-01)


### Performance Improvements

* **web:** reduce public page loading and preserve document SSR ([#35](https://github.com/echovisionlab/geul-web/issues/35)) ([3ef1a86](https://github.com/echovisionlab/geul-web/commit/3ef1a867aa9fcfcb6bc4552c0449d2113734e1f9))

## [0.2.5](https://github.com/echovisionlab/geul-web/compare/v0.2.4...v0.2.5) (2026-09-30)


### Bug Fixes

* **web:** clarify editor planning and action outcomes ([#33](https://github.com/echovisionlab/geul-web/issues/33)) ([d84dc5a](https://github.com/echovisionlab/geul-web/commit/d84dc5a1aaaa1f0e1ab2eac0663bccf3aa0e81d4))

## [0.2.4](https://github.com/echovisionlab/geul-web/compare/v0.2.3...v0.2.4) (2026-09-30)


### Bug Fixes

* **page:** share section insertion menus and labels ([#31](https://github.com/echovisionlab/geul-web/issues/31)) ([bc222f1](https://github.com/echovisionlab/geul-web/commit/bc222f16c47687cda853f5d4082504116946a98f))

## [0.2.3](https://github.com/echovisionlab/geul-web/compare/v0.2.2...v0.2.3) (2026-09-30)


### Bug Fixes

* preserve editor content and enforce site API contracts ([38186b5](https://github.com/echovisionlab/geul-web/commit/38186b59488aad036d4751e73c6d2ced6ce70598))
* preserve editor content and enforce site API contracts ([cd7e1a0](https://github.com/echovisionlab/geul-web/commit/cd7e1a077643ad534e2da9eff955c49ca128964c))

## [0.2.2](https://github.com/echovisionlab/geul-web/compare/v0.2.1...v0.2.2) (2026-09-30)


### Performance Improvements

* **editor:** reduce Post and Page input overhead ([#27](https://github.com/echovisionlab/geul-web/issues/27)) ([e9ad0cd](https://github.com/echovisionlab/geul-web/commit/e9ad0cdcf79c117ab22cd83295df9be74b16eb41))

## [0.2.1](https://github.com/echovisionlab/geul-web/compare/v0.2.0...v0.2.1) (2026-09-30)


### Bug Fixes

* **ci:** preserve generated release manifest formatting ([#21](https://github.com/echovisionlab/geul-web/issues/21)) ([52cc1dc](https://github.com/echovisionlab/geul-web/commit/52cc1dc5cbe15c1a1a92b0ccfa818a2628051ccf))
* preserve Page edits across save and reload boundaries ([#26](https://github.com/echovisionlab/geul-web/issues/26)) ([09aa698](https://github.com/echovisionlab/geul-web/commit/09aa69828fea47efe279c26ccb011297c51c0283))

## [0.2.0](https://github.com/echovisionlab/geul-web/compare/v0.1.6...v0.2.0) (2026-09-08)


### Features

* **editor:** add Mermaid blocks and configurable site branding ([#19](https://github.com/echovisionlab/geul-web/issues/19)) ([f810e01](https://github.com/echovisionlab/geul-web/commit/f810e01844ea3ef5aed052a609f2f171d13aac75))

## [0.1.6](https://github.com/echovisionlab/geul-web/compare/v0.1.5...v0.1.6) (2026-09-06)


### Bug Fixes

* **ui:** simplify YouTube audio entry form ([#17](https://github.com/echovisionlab/geul-web/issues/17)) ([ffc0936](https://github.com/echovisionlab/geul-web/commit/ffc0936b3de8ac75cd13b56cf3e59a6c52004e20))

## [0.1.5](https://github.com/echovisionlab/geul-web/compare/v0.1.4...v0.1.5) (2026-09-06)


### Bug Fixes

* **editor:** preserve queued edits and report save failures ([#15](https://github.com/echovisionlab/geul-web/issues/15)) ([4e3f8b3](https://github.com/echovisionlab/geul-web/commit/4e3f8b3c927058d1da958626dba9ced53b7a3818))

## [0.1.4](https://github.com/echovisionlab/geul-web/compare/v0.1.3...v0.1.4) (2026-09-06)


### Bug Fixes

* streamline YouTube audio actions and original downloads ([#13](https://github.com/echovisionlab/geul-web/issues/13)) ([270d206](https://github.com/echovisionlab/geul-web/commit/270d206799225da828a9447ec48590a2387fd22f))

## [0.1.3](https://github.com/echovisionlab/geul-web/compare/v0.1.2...v0.1.3) (2026-09-04)


### Bug Fixes

* stabilize YouTube audio conversion state ([#11](https://github.com/echovisionlab/geul-web/issues/11)) ([9fe3f45](https://github.com/echovisionlab/geul-web/commit/9fe3f4579e09036d02514f085e954a2a222fa1fc))

## [0.1.2](https://github.com/echovisionlab/geul-web/compare/v0.1.1...v0.1.2) (2026-09-03)


### Bug Fixes

* update YouTube audio range source ([#9](https://github.com/echovisionlab/geul-web/issues/9)) ([c2dea01](https://github.com/echovisionlab/geul-web/commit/c2dea01b6b16a1e75be9568cf4020a215acf767e))

## [0.1.1](https://github.com/echovisionlab/geul-web/compare/v0.1.0...v0.1.1) (2026-09-02)


### Bug Fixes

* harden package boundary and changelog parsing ([#7](https://github.com/echovisionlab/geul-web/issues/7)) ([56ad3e6](https://github.com/echovisionlab/geul-web/commit/56ad3e693d1284041524c8f0597f8bcb8380b3f0))

## 0.1.0 (2026-09-02)


### Features

* publish initial Geul web application ([4829d1a](https://github.com/echovisionlab/geul-web/commit/4829d1a157007352dc0042f5ccd0eb5a649ca792))


### Bug Fixes

* initialize release changelog cleanly ([#5](https://github.com/echovisionlab/geul-web/issues/5)) ([369d643](https://github.com/echovisionlab/geul-web/commit/369d643e1fa0d393f03808fb751fd49bc3e38884))
* validate initial release metadata ([#3](https://github.com/echovisionlab/geul-web/issues/3)) ([b07a85f](https://github.com/echovisionlab/geul-web/commit/b07a85f0ce7b39e9131fa5dca2499ffad5321ff0))

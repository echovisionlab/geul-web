/** Explicit fixture boundary in every locale exposed by the global kit toolbar. */
const labels: Record<string, string> = {
  en: 'Local browser files only. No server upload.',
  ko: '브라우저의 로컬 파일만 사용합니다. 서버에 업로드하지 않습니다.',
  ja: 'ブラウザーのローカルファイルのみ。サーバーにはアップロードしません。',
  zh: '仅使用浏览器本地文件，不上传到服务器。',
  'zh-TW': '僅使用瀏覽器本機檔案，不上傳到伺服器。',
  de: 'Nur lokale Browser-Dateien. Kein Server-Upload.',
  fr: 'Fichiers locaux du navigateur uniquement. Aucun envoi au serveur.',
  es: 'Solo archivos locales del navegador. Sin carga al servidor.',
  pt: 'Apenas arquivos locais do navegador. Sem envio ao servidor.',
  it: 'Solo file locali del browser. Nessun caricamento sul server.',
  ru: 'Только локальные файлы браузера. Без загрузки на сервер.',
  ar: 'ملفات المتصفح المحلية فقط. لا تُرفع إلى الخادم.',
  hi: 'केवल ब्राउज़र की स्थानीय फ़ाइलें। सर्वर पर अपलोड नहीं होता।',
  id: 'Hanya berkas lokal browser. Tidak diunggah ke server.',
  vi: 'Chỉ dùng tệp cục bộ của trình duyệt. Không tải lên máy chủ.',
  th: 'ใช้เฉพาะไฟล์ในเบราว์เซอร์ ไม่มีการอัปโหลดไปยังเซิร์ฟเวอร์',
  tr: 'Yalnızca yerel tarayıcı dosyaları. Sunucuya yüklenmez.',
  nl: 'Alleen lokale browserbestanden. Geen upload naar de server.',
  pl: 'Tylko lokalne pliki przeglądarki. Bez przesyłania na serwer.',
  uk: 'Лише локальні файли браузера. Без завантаження на сервер.',
};
export function localFilePreviewLabel(locale: string) {
  return labels[locale] ?? labels[locale.split('-')[0]!] ?? labels.en!;
}

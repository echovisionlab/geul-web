export async function mount(host, initialContext) {
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    ':host{display:block}section{padding:24px;border:1px solid #888;border-radius:12px;font:16px system-ui}button{padding:8px 16px;font:inherit}p{padding:24px 0}';
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  const button = document.createElement('button');
  const content = document.createElement('div');
  let rows = 1;
  let context = initialContext;
  const paint = () => {
    heading.textContent = context.locale === 'ko' ? '직접 실행 도구' : 'Direct module tool';
    button.textContent = context.locale === 'ko' ? '내용 추가' : 'Add content';
    section.style.background = context.colorScheme === 'dark' ? '#202124' : '#fff';
    section.style.color = context.colorScheme === 'dark' ? '#fff' : '#202124';
    content.replaceChildren(
      ...Array.from({ length: rows }, (_, index) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = `${context.locale} · ${index + 1}`;
        return paragraph;
      }),
    );
  };
  const add = () => {
    rows += 1;
    paint();
  };
  button.addEventListener('click', add);
  section.append(heading, button, content);
  shadow.append(style, section);
  paint();
  return {
    update(next) {
      context = next;
      paint();
    },
    destroy() {
      button.removeEventListener('click', add);
      shadow.replaceChildren();
    },
  };
}

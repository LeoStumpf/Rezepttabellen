/** Kurze Rückmeldung unten am Bildschirm („5 Zutaten auf der Liste“). */
export const meldung = $state({ text: '', link: '', linkText: '' });

let timer: ReturnType<typeof setTimeout> | undefined;

export function zeigeMeldung(text: string, link?: { href: string; text: string }) {
  meldung.text = text;
  meldung.link = link?.href ?? '';
  meldung.linkText = link?.text ?? '';
  clearTimeout(timer);
  timer = setTimeout(() => (meldung.text = ''), 4000);
}

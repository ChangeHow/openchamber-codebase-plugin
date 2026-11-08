import {
  OPENCHAMBER_SDK_API_VERSION,
  OPENCHAMBER_SDK_CHANNEL,
  type AttachIssueRequest,
  type HostMessage,
  type HostReadyContext,
} from '@openchamber/sdk';
import { guestMessageSchema } from '@openchamber/sdk/schemas';

const frame = document.getElementById('extension');
const output = document.getElementById('attachments');
const selector = document.getElementById('theme');
if (!(frame instanceof HTMLIFrameElement) || !output || !(selector instanceof HTMLSelectElement))
  throw new Error('Preview elements are missing.');
const style = document.createElement('style');
style.textContent =
  'body { color: CanvasText; background: Canvas; font: 0.875rem system-ui; margin: 1rem; } iframe { display: block; width: min(100%, 44rem); height: 38rem; margin-block: 1rem; border: 1px solid GrayText; } pre { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 44rem; } h2 { font-size: 1rem; }';
document.head.append(style);
const attachments: AttachIssueRequest[] = [];

const ready = (): HostReadyContext => {
  const mode = selector.value === 'dark' ? 'dark' : 'light';
  document.documentElement.style.colorScheme = mode;
  return {
    theme: {
      mode,
      tokens: {
        background: 'Canvas',
        elevated: 'Canvas',
        foreground: 'CanvasText',
        muted: 'GrayText',
        subtle: 'Canvas',
        border: 'GrayText',
        hover: 'color-mix(in srgb, CanvasText 8%, Canvas)',
        selection: 'Highlight',
        focus: 'Highlight',
        primary: 'Highlight',
        mutedSurface: 'color-mix(in srgb, CanvasText 5%, Canvas)',
        elevatedForeground: 'CanvasText',
        active: 'Highlight',
        selectionForeground: 'HighlightText',
        primaryForeground: 'HighlightText',
        primaryText: 'CanvasText',
        successText: 'CanvasText',
        warningText: 'CanvasText',
        errorText: 'CanvasText',
        infoText: 'CanvasText',
        success: 'CanvasText',
        warning: 'CanvasText',
        error: 'CanvasText',
        info: 'CanvasText',
        font: 'system-ui',
        mono: 'monospace',
        radius: '6px',
      },
    },
    locale: 'en',
    directory: null,
    session: null,
    surface: 'panel',
    connection: { connected: false, account: '' },
    settings: {},
    item: null,
  };
};
const send = (message: HostMessage): void => {
  frame.contentWindow?.postMessage(message, '*');
};
function sendReady(): void {
  send({
    channel: OPENCHAMBER_SDK_CHANNEL,
    v: OPENCHAMBER_SDK_API_VERSION,
    type: 'ready',
    payload: ready(),
  });
}
selector.addEventListener('change', sendReady);

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.source !== frame.contentWindow) return;
  const parsed = guestMessageSchema.safeParse(event.data);
  if (!parsed.success) return;
  const message = parsed.data;
  if (message.type === 'hello') return sendReady();
  if (!('id' in message)) return;
  const base = {
    channel: OPENCHAMBER_SDK_CHANNEL,
    v: OPENCHAMBER_SDK_API_VERSION,
    type: 'result',
    id: message.id,
  } as const;
  if (message.type === 'attach') {
    attachments.push(message.payload);
    output.textContent = JSON.stringify(attachments, null, 2);
    return send({ ...base, ok: true });
  }
  if (message.type !== 'service-request')
    return send({
      ...base,
      ok: false,
      error: 'Not implemented by the synthetic preview.',
      code: 'UNSUPPORTED',
    });
  const query = new URLSearchParams(message.payload.query);
  void fetch(`/api${message.payload.path}?${query}`)
    .then(async (response) => {
      send({
        ...base,
        ok: true,
        payload: { status: response.status, body: await response.text() },
      });
    })
    .catch(() => {
      send({
        ...base,
        ok: false,
        error: 'Preview service is unavailable.',
        code: 'SERVICE_FAILED',
      });
    });
});

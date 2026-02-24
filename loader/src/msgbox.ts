
function injectStyle() {
    if (document.getElementById('msgbox-style')) return;
    const style = document.createElement('style');
    style.id = 'msgbox-style';
    style.textContent = `
        .msgbox-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1000000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .msgbox-dialog {
            background: #fff;
            padding: 24px;
            border-radius: 12px;
            min-width: 320px;
            max-width: 90%;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            animation: msgbox-fade-in 0.2s ease-out;
        }
        @keyframes msgbox-fade-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        .msgbox-content {
            margin-bottom: 24px;
            color: #1f2328;
            font-size: 16px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .msgbox-input {
            width: 100%;
            padding: 10px 12px;
            margin-bottom: 24px;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .msgbox-input:focus {
            border-color: #0969da;
            box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
        }
        .msgbox-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        .msgbox-btn {
            padding: 8px 16px;
            border: 1px solid rgba(27, 31, 36, 0.15);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
            user-select: none;
        }
        .msgbox-btn-cancel {
            background-color: #f6f8fa;
            color: #1f2328;
        }
        .msgbox-btn-cancel:hover {
            background-color: #f3f4f6;
        }
        .msgbox-btn-ok {
            background-color: #2da44e;
            color: #ffffff;
        }
        .msgbox-btn-ok:hover {
            background-color: #2c974b;
        }
    `;
    document.head.appendChild(style);
}

function createBox(message: string, options: { showInput?: boolean, defaultValue?: string, showCancel?: boolean }) {
    injectStyle();
    
    return new Promise<string | boolean | null>((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'msgbox-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'msgbox-dialog';
        
        const content = document.createElement('div');
        content.className = 'msgbox-content';
        content.textContent = message;
        dialog.appendChild(content);
        
        const input = options.showInput ? document.createElement('input') : null;
        if (input) {
            input.className = 'msgbox-input';
            input.value = options.defaultValue || '';
            dialog.appendChild(input);
        }
        
        const actions = document.createElement('div');
        actions.className = 'msgbox-actions';
        
        let handleEscape: ((e: KeyboardEvent) => void) | null = null;
        const cleanup = () => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            if (handleEscape) {
                window.removeEventListener('keydown', handleEscape);
            }
        };

        const onCancel = () => {
            cleanup();
            resolve(options.showInput ? null : false);
        };

        const onOk = () => {
            const val = input ? input.value : true;
            cleanup();
            resolve(val);
        };

        if (options.showCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'msgbox-btn msgbox-btn-cancel';
            cancelBtn.textContent = '取消';
            cancelBtn.onclick = onCancel;
            actions.appendChild(cancelBtn);
        }
        
        const okBtn = document.createElement('button');
        okBtn.className = 'msgbox-btn msgbox-btn-ok';
        okBtn.textContent = '确定';
        okBtn.onclick = onOk;
        actions.appendChild(okBtn);
        
        dialog.appendChild(actions);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        if (input) {
            input.focus();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') onOk();
                if (e.key === 'Escape') {
                    if (options.showCancel) onCancel();
                    else {
                        cleanup();
                        resolve(null);
                    }
                }
            };
        } else {
            okBtn.focus();
            handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    if (options.showCancel) onCancel();
                    else onOk();
                }
            };
            window.addEventListener('keydown', handleEscape);
        }
    });
}

export function alert(message: string): Promise<void> {
    return createBox(message, { showCancel: false }).then(() => {});
}

export function confirm(message: string): Promise<boolean> {
    return createBox(message, { showCancel: true }) as Promise<boolean>;
}

export function prompt(message: string, defaultValue: string = ''): Promise<string | null> {
    return createBox(message, { showInput: true, defaultValue, showCancel: true }) as Promise<string | null>;
}

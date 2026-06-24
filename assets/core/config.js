// Silencia logs e depuracao em producao para garantir seguranca e F12 100% limpo
if (typeof window !== 'undefined') {
    const _hn = window.location.hostname;
    const _isDev = _hn === 'localhost'
        || _hn === '127.0.0.1'
        || _hn.startsWith('192.168.')
        || _hn.startsWith('10.')
        || _hn.startsWith('172.');

    if (!_isDev) {
        const _preserved = {};
        const methodsToSilence = [
            'log', 'info', 'warn', 'error', 'debug', 'table', 'trace', 'dir', 'dirxml',
            'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'timeLog',
            'count', 'countReset', 'assert', 'profile', 'profileEnd', 'timeStamp', 'clear'
        ];

        // Descobre e silencia todos os metodos presentes no objeto console do navegador
        try {
            const allProps = Object.getOwnPropertyNames(window.console || {});
            allProps.forEach(prop => {
                if (typeof window.console[prop] === 'function') {
                    _preserved['_' + prop] = window.console[prop];
                    try {
                        window.console[prop] = function() {};
                    } catch(e) {}
                }
            });
        } catch(e) {}

        // Garante o silenciamento dos metodos padrao (caso nao tenham sido enumerados)
        methodsToSilence.forEach(method => {
            if (window.console) {
                if (!_preserved['_' + method] && typeof window.console[method] === 'function') {
                    _preserved['_' + method] = window.console[method];
                }
                try {
                    window.console[method] = function() {};
                } catch(e) {}
            }
        });

        // Expoe os originais como propriedades ocultas/nao-enumeraveis no console
        try {
            Object.defineProperty(window.console, '_preserved', {
                value: _preserved,
                writable: false,
                enumerable: false,
                configurable: true
            });
            Object.keys(_preserved).forEach(k => {
                try {
                    Object.defineProperty(window.console, k, {
                        value: _preserved[k],
                        writable: false,
                        enumerable: false,
                        configurable: true
                    });
                } catch(e) {}
            });
        } catch(e) {}
    }
}

const CONFIG = {
    api: {
        scriptURL: 'https://script.google.com/macros/s/AKfycbzvvrQ6wmJfSDvQ-jiNcqfHmRPwUcOmafxJw64-s6GAs-E6egslZo-N3Lep6852YPjISA/exec'
    },

    // Ambiente MP: 'PROD' | 'TEST'. Sincronizado pelo ATUALIZAR_SERVIDOR.bat.
    mp: { ambiente: 'TEST' },

    // Codigos de produto reservados — sincronizados com CODES no Roteamento_API.gs
    codes: { VIP: 'VIP_SITE' },

    app: {
        name: 'Acervo dos Entusiastas',
        version: '1.0.0',
        buildVersion: '1782278697940',
        description: 'Sistemas de Alta Performance com instalacao em 3 minutos'
    },

    ui: {
        testimonials: {
            autoplay: true,
            interval: 5000,
            transitionSpeed: 400,
            showDots: true,
            showArrows: true
        },

        allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],

        lightbox: {
            animationSpeed: 300,
            closeOnClickOutside: true,
            showCounter: true
        }
    }
};

function getConfig(key, defaultValue = null) {
    const parts = key.split('.');
    let result = CONFIG;

    for (const part of parts) {
        if (result && typeof result === 'object' && part in result) {
            result = result[part];
        } else {
            return defaultValue;
        }
    }

    return result !== undefined ? result : defaultValue;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, getConfig };
} else {
    window.CONFIG = CONFIG;
    window.getConfig = getConfig;
}

// =========================================================================
// CAMADA DE SEGURANCA: Protecao de dados sensiveis no navegador
// =========================================================================
//
// 1. SessionStorage Proxy: ofusca nomes de chaves e codifica valores em base64.
//    O codigo existente continua usando sessionStorage.getItem('currentUser')
//    normalmente — a interceptacao e 100% transparente.
//
// 2. Anti-DevTools: bloqueia F12, Ctrl+Shift+I, Ctrl+U e clique direito.
//
// 3. Variaveis Globais: torna propriedades sensiveis nao-enumeraveis no window,
//    impedindo que aparecam ao digitar "window" no console.
// =========================================================================

(function _initSecurityLayer() {
    'use strict';
    if (typeof window === 'undefined') return; // Skip no Node.js (build)

    // Chaves a serem ofuscadas
    const _km = {
        'currentUser': '_s0', 'currentUserName': '_s1', 'isVIP': '_s2',
        '_apiToken': '_s3', '_apiTokenTime': '_s4', 'pagamentoAtual': '_s5',
        'bypassLanding': '_s6', 'justLoggedIn': '_s7',
        'identificadorRecuperado': '_s8', 'emailCadastrado': '_s9',
        'currentUserAvatar': '_s10', 'ss_cart': '_s11', 'ss_coupon': '_s12', 'ss_pedidos': '_s13'
    };

    const _oSetS = sessionStorage.setItem.bind(sessionStorage);
    const _oGetS = sessionStorage.getItem.bind(sessionStorage);
    const _oRemS = sessionStorage.removeItem.bind(sessionStorage);

    const _oSetL = localStorage.setItem.bind(localStorage);
    const _oGetL = localStorage.getItem.bind(localStorage);
    const _oRemL = localStorage.removeItem.bind(localStorage);

    // -- 1. Storage Proxies --
    function _createProxy(storageObj, _oSet, _oGet, _oRem) {
        storageObj.setItem = function(key, value) {
            if (key === 'APP_BUILD_VERSION' || key === 'skullstore_catalog_v1') { _oSet(key, String(value)); return; }
            const k = _km[key] || key;
            try { _oSet(k, btoa(unescape(encodeURIComponent(String(value))))); }
            catch(e) { _oSet(k, String(value)); }
        };

        storageObj.getItem = function(key) {
            if (key === 'APP_BUILD_VERSION' || key === 'skullstore_catalog_v1') return _oGet(key);
            const k = _km[key] || key;
            let val = _oGet(k);

            // Migracao automatica
            if (val === null && k !== key) {
                val = _oGet(key);
                if (val !== null) {
                    try { _oSet(k, btoa(unescape(encodeURIComponent(String(val))))); }
                    catch(e) { _oSet(k, val); }
                    _oRem(key);
                    return val;
                }
            }

            if (val === null) return null;
            try { return decodeURIComponent(escape(atob(val))); }
            catch(e) { return val; }
        };

        storageObj.removeItem = function(key) {
            if (key === 'APP_BUILD_VERSION' || key === 'skullstore_catalog_v1') { _oRem(key); return; }
            const k = _km[key] || key;
            _oRem(k);
            if (k !== key) _oRem(key);
        };
    }

    _createProxy(sessionStorage, _oSetS, _oGetS, _oRemS);
    _createProxy(localStorage, _oSetL, _oGetL, _oRemL);

    // -- 2. Anti-DevTools --
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12') { e.preventDefault(); return; }
        if (e.ctrlKey && e.shiftKey && /^[IJCijc]$/.test(e.key)) { e.preventDefault(); return; }
        if (e.ctrlKey && /^[uU]$/.test(e.key)) { e.preventDefault(); return; }
    }, true);

    // -- 3. Variaveis Globais --
    // Torna propriedades sensiveis nao-enumeraveis (nao aparecem em Object.keys(window))
    window._blindarPropriedade = function(prop) {
        if (prop in window) {
            const val = window[prop];
            try {
                Object.defineProperty(window, prop, {
                    value: val, writable: true, enumerable: false, configurable: true
                });
            } catch(e) { /* propriedade nao configuravel - ignora */ }
        }
    };

    // -- 4. Decodificador de Resposta da API --
    // Decodifica respostas base64 do servidor com suporte completo a UTF-8
    // (emojis, acentos, caracteres especiais).
    window._decodeResponse = function(data) {
        if (!data || !data._ || typeof data._ !== 'string') return data;
        try {
            const raw = atob(data._);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            return JSON.parse(new TextDecoder('utf-8').decode(bytes));
        } catch(e) {
            try { return JSON.parse(atob(data._)); } catch(e2) { return data; }
        }
    };
})();

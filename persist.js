// Kleine Helfer für den Browser: Speichern der Datenbank in IndexedDB, Export/Import als Datei,
// Service Worker. Wird von der Kotlin-Seite (WebDatenbank.kt) über window.essensplanStore benutzt.
(function () {
    var DB_NAME = "essensplan";
    var STORE = "kv";
    var KEY = "datenbank";

    function oeffneIdb() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function idb(modus, aktion) {
        return oeffneIdb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(STORE, modus);
                var req = aktion(tx.objectStore(STORE));
                tx.oncomplete = function () { db.close(); resolve(req ? req.result : undefined); };
                tx.onerror = function () { db.close(); reject(tx.error); };
                tx.onabort = function () { db.close(); reject(tx.error); };
            });
        });
    }

    window.essensplanStore = {
        // Liefert Uint8Array oder null (noch nichts gespeichert / IndexedDB nicht verfügbar)
        load: function () {
            return idb("readonly", function (s) { return s.get(KEY); })
                .then(function (v) { return v ? new Uint8Array(v) : null; })
                .catch(function (e) { console.warn("Laden aus IndexedDB fehlgeschlagen", e); return null; });
        },
        // Das Ergebnis wird als Wahrheitswert zurückgegeben, damit Kotlin nicht mit Ausnahmen umgehen muss
        save: function (bytes) {
            var kopie = bytes.slice(0).buffer;
            return idb("readwrite", function (s) { return s.put(kopie, KEY); })
                .then(function () { return true; })
                .catch(function (e) { console.warn("Speichern in IndexedDB fehlgeschlagen", e); return false; });
        },
        // Teilen-Dialog (iPhone/Android), sonst normaler Download
        exportiere: function (bytes, dateiname) {
            var datei = new File([bytes], dateiname, { type: "application/octet-stream" });
            if (navigator.canShare && navigator.canShare({ files: [datei] })) {
                return navigator.share({ files: [datei], title: dateiname })
                    .then(function () { return true; })
                    .catch(function (e) { return e && e.name === "AbortError"; });
            }
            var url = URL.createObjectURL(datei);
            var a = document.createElement("a");
            a.href = url;
            a.download = dateiname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
            return Promise.resolve(true);
        },
        // Dateiauswahl; liefert Uint8Array oder null bei Abbruch.
        // Das Eingabefeld hängt dafür kurz im Dokument (manche Browser öffnen den Dialog sonst nicht).
        waehleDatei: function () {
            return new Promise(function (resolve) {
                var input = document.createElement("input");
                input.type = "file";
                input.style.display = "none";
                function aufraeumen() { if (input.parentNode) input.parentNode.removeChild(input); }
                input.onchange = function () {
                    var f = input.files && input.files[0];
                    aufraeumen();
                    if (!f) { resolve(null); return; }
                    f.arrayBuffer().then(function (b) { resolve(new Uint8Array(b)); },
                                         function () { resolve(null); });
                };
                input.oncancel = function () { aufraeumen(); resolve(null); };
                document.body.appendChild(input);
                input.click();
            });
        },
        meldung: function (text) { window.alert(text); },
        bitteUmDauerhaftenSpeicher: function () {
            if (navigator.storage && navigator.storage.persist) {
                navigator.storage.persist().catch(function () {});
            }
        }
    };

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("sw.js").catch(function (e) {
                console.warn("Service Worker nicht registriert", e);
            });
        });
    }
})();

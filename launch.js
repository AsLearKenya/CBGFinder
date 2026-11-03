/* API-backed pages must run on the local HTTP service. */
if(location.protocol==='file:')location.replace('http://127.0.0.1:5173/'+location.hash);

# Repasse comum para o container audita-proxy (incluído pelos blocos 443 de audita-https.conf).
set $audita_proxy http://audita-proxy:80;

location / {
  proxy_pass $audita_proxy;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $http_connection;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  proxy_request_buffering off;
  proxy_buffering off;
}

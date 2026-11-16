from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import letter
from pathlib import Path

OUT=Path(__file__).resolve().parents[2]/'GRIPXELL_Ejemplo_Reporte_Moderno.pdf'
pdfmetrics.registerFont(TTFont('DVS','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVSb','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
c=Canvas(str(OUT),pagesize=letter)
W,H=letter
N='#102d3b'; T='#16aaad'; M='#728491'; P='#f3f7f8'; D='#e0eaed'; K='#1a3342'; G='#e9f7f4'
def rect(x,y,w,h,fill,r=0):
 c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(fill));c.roundRect(x,H-y-h,w,h,r,stroke=0,fill=1)
def txt(s,x,y,size=10,color=K,bold=False):
 c.setFillColor(HexColor(color));c.setFont('DVSb' if bold else 'DVS',size);c.drawString(x,H-y-size,s)
def right(s,x,y,size=10,color=K,bold=False):
 c.setFillColor(HexColor(color));c.setFont('DVSb' if bold else 'DVS',size);c.drawRightString(x,H-y-size,s)
def line(x,y,x2,y2,color=D):
 c.setStrokeColor(HexColor(color));c.setLineWidth(.7);c.line(x,H-y,x2,H-y2)
rect(0,0,W,122,N)
rect(0,117,W,5,T)
rect(41,23,8,50,T,4)
txt('GRIPXELL',63,20,26,'#ffffff',True)
txt('SMART PHONES Y MÁS',64,58,10,'#bbdadc',True)
right('ESTADO DE CUENTA',566,23,10,'#8cdddd',True)
right('N°001417',566,40,20,'#ffffff',True)
right('17 / MARZO / 2026',566,72,10,'#dce7ea')
rect(42,139,528,100,P,10)
txt('INFORMACIÓN DEL CLIENTE',57,150,9,M,True)
txt('CLIENTE DE EJEMPLO',57,167,15,N,True)
txt('DIRECCIÓN',57,201,8,M,True);txt('Gómez Palacio, Durango',120,200,10,K)
txt('RFC',426,201,8,M,True);txt('—',456,200,10,K)
for x,label,amount in [(42,'VALOR DEL EQUIPO','$19,500.00'),(223,'TOTAL ABONADO','$11,450.00'),(404,'SALDO PENDIENTE','$8,050.00')]:
 rect(x,253,166,68,G if x==404 else P,9);txt(label,x+12,265,8,'#137880' if x==404 else M,True);txt(amount,x+12,287,15,'#0d8187' if x==404 else N,True)
txt('EQUIPO Y CONDICIONES',43,337,10,N,True);line(42,358,569,358)
rect(42,371,528,27,N,5)
txt('CANT.',54,378,8,'#ffffff',True);txt('DESCRIPCIÓN',118,378,8,'#ffffff',True);right('IMPORTE',556,378,8,'#ffffff',True)
rect(42,401,528,34,P,2)
txt('1',54,413,9,N);txt('iPhone 15 — Negro',118,413,10,N,True);right('$19,500.00',557,413,10,N,True)
rect(42,443,528,39,G,7)
txt('ENGANCHE',55,450,8,M,True);txt('$3,000.00',55,464,9,N,True)
txt('ABONO SEMANAL',268,450,8,M,True);txt('$350.00',268,464,9,N,True)
txt('HISTORIAL DE PAGOS',42,495,10,N,True);line(42,515,570,515)
rect(42,521,528,22,N,5)
txt('FECHA',52,527,8,'#ffffff',True);txt('MOVIMIENTO',144,527,8,'#ffffff',True);right('PAGO',450,527,8,'#ffffff',True);right('RESTA',560,527,8,'#ffffff',True)
rows=[('17/03/2026','Enganche',3000,16500),('21/03 al 15/08','Abonos acumulados',5000,11500),('22/08/2026','Semana sin pago',0,11500),('28/08/2026','Abono',300,11200),('13/09/2026','Abono',250,10950),('19/09/2026','Abono',350,10600),('25/09/2026','Abono',500,10100),('04/10/2026','Abono',500,9600),('09/10/2026','Abono',400,9200),('17/10/2026','Semana sin pago',0,9200),('23/10/2026','Abono',400,8800),('30/10/2026','Abono',400,8400),('07/11/2026','Abono',350,8050)]
for idx,(fecha,desc,pago,saldo) in enumerate(rows):
 y=545+idx*13.1
 if idx%2==0:rect(42,y,528,13.1,P)
 txt(fecha,52,y+1.1,7.5,K);txt(desc,144,y+1.1,7.6,N,desc!='Abono');right(f'${pago:,.2f}' if pago else '—',450,y+1.1,7.7,K)
 right(f'${saldo:,.2f}',560,y+1.1,7.7,N,True)
rect(42,724,528,45,G,7)
txt('TOTAL',55,731,8,M,True);txt('$19,500.00',55,746,9,N,True)
txt('ABONADO',247,731,8,M,True);txt('$11,450.00',247,746,9,N,True)
txt('RESTA',450,731,8,'#168384',True);txt('$8,050.00',450,746,10,'#0a797d',True)
# One page letter: bottom limited; avoid c footer beyond page.
c.setTitle('GRIPXELL - Ejemplo de estado de cuenta moderno')
c.setAuthor('GRIPXELL')
c.save()
print(OUT)

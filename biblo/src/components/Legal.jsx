import { useEffect } from 'react'
import { OwlIcon } from './Icons'
import './Legal.css'

// Aviso de privacidad (#privacidad) y Términos y condiciones (#terminos),
// enlazados desde el pie de página de la tienda.
// Biblo es un proyecto escolar: los datos de contacto son de ejemplo.
const UPDATED = '31 de octubre de 2026'
const CONTACT = 'privacidad@biblo.test'

export default function Legal({ page }) {
  const privacy = page === 'privacidad'

  useEffect(() => {
    const previous = document.title
    document.title = `${privacy ? 'Aviso de privacidad' : 'Términos y condiciones'} · Biblo`
    return () => {
      document.title = previous
    }
  }, [privacy])

  return (
    <div className="legal">
      <header className="topbar">
        <a className="topbar__brand" href="#" aria-label="Volver a la tienda">
          <OwlIcon className="topbar__owl" />
          <span>Biblo</span>
        </a>
        <a className="legal__back" href="#">
          ← Volver a la tienda
        </a>
      </header>

      <article className="legal__sheet">
        {privacy ? <Privacy /> : <Terms />}
        <footer className="legal__foot">
          <p>Última actualización: {UPDATED}.</p>
          <p>
            {privacy ? (
              <a href="#terminos">Leer también los Términos y condiciones</a>
            ) : (
              <a href="#privacidad">Leer también el Aviso de privacidad</a>
            )}
          </p>
        </footer>
      </article>
    </div>
  )
}

function Privacy() {
  return (
    <>
      <h1>Aviso de privacidad</h1>
      <p className="legal__lead">
        En Biblo, la biblioteca viva, cuidamos los datos personales que nos confías. Este aviso explica qué datos
        recabamos, para qué los usamos y cómo puedes ejercer tus derechos, conforme a la Ley Federal de Protección
        de Datos Personales en Posesión de los Particulares (LFPDPPP).
      </p>

      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        Biblo, tienda en línea de libros, es responsable del tratamiento de tus datos personales. Para cualquier
        asunto relacionado con este aviso puedes escribirnos a <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <h2>2. Qué datos recabamos</h2>
      <ul>
        <li>
          <strong>Datos de tu cuenta:</strong> nombre, correo electrónico y contraseña. La contraseña se guarda
          cifrada (con un hash irreversible); nadie en Biblo puede leerla.
        </li>
        <li>
          <strong>Datos de envío:</strong> nombre de quien recibe, calle, números exterior e interior, colonia,
          código postal, ciudad o municipio, estado, teléfono y referencias de la dirección.
        </li>
        <li>
          <strong>Datos de tus compras:</strong> los libros que pides, sus cantidades, precios, fechas y el estado
          del pago y del envío.
        </li>
      </ul>
      <p>
        <strong>No guardamos los datos de tu tarjeta.</strong> El número completo y el código de seguridad (CVV)
        se usan solo durante el cobro y se descartan; de cada pago conservamos únicamente la marca de la tarjeta y
        sus últimos cuatro dígitos, como aparecen en cualquier comprobante. No recabamos datos personales
        sensibles.
      </p>

      <h2>3. Para qué usamos tus datos</h2>
      <p>Finalidades necesarias para darte el servicio:</p>
      <ul>
        <li>Crear y administrar tu cuenta e identificarte cuando inicias sesión.</li>
        <li>Procesar tus pedidos y pagos, y enviarte los libros a la dirección que elijas.</li>
        <li>Mostrarte el historial y el estado de tus pedidos.</li>
        <li>Atender aclaraciones, cancelaciones y devoluciones.</li>
      </ul>
      <p>
        No usamos tus datos para publicidad ni los vendemos. Si algún día quisiéramos usarlos para otra
        finalidad, te pediríamos antes tu consentimiento.
      </p>

      <h2>4. Con quién compartimos tus datos</h2>
      <p>
        Solo con quien hace falta para entregarte tu pedido: la empresa de paquetería recibe el nombre de quien
        recibe, la dirección y el teléfono, y la pasarela de pagos recibe los datos de la tarjeta para hacer el
        cobro. También podríamos compartirlos con una autoridad que lo solicite conforme a la ley.
      </p>

      <h2>5. Tus derechos ARCO</h2>
      <p>
        Tienes derecho a <strong>A</strong>cceder a tus datos, <strong>R</strong>ectificarlos si son inexactos,{' '}
        <strong>C</strong>ancelarlos cuando consideres que no se necesitan y <strong>O</strong>ponerte a su uso
        para fines específicos, así como a revocar tu consentimiento. Para ejercerlos, escribe a{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a> desde el correo de tu cuenta, indicando qué derecho quieres
        ejercer y sobre qué datos. Te responderemos en un plazo máximo de 20 días hábiles.
      </p>

      <h2>6. Cuánto tiempo los conservamos</h2>
      <p>
        Mientras tu cuenta esté activa. Los datos de compras se conservan el tiempo que exigen las obligaciones
        fiscales y comerciales, aunque canceles tu cuenta.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Usamos una sola cookie técnica, la de sesión, para mantenerte identificado mientras navegas. Tu carrito y
        tu progreso en la biblioteca se guardan solo en tu navegador. No usamos cookies de publicidad ni de
        rastreo.
      </p>

      <h2>8. Cambios a este aviso</h2>
      <p>Cualquier cambio a este aviso se publicará en esta misma página, con su fecha de actualización.</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Términos y condiciones</h1>
      <p className="legal__lead">
        Al comprar en Biblo aceptas estas condiciones. Las escribimos en lenguaje claro para que sepas qué esperar
        de tu pedido antes, durante y después del envío.
      </p>

      <h2>1. Cuentas</h2>
      <p>
        Para comprar necesitas una cuenta con un correo válido. Eres responsable de mantener tu contraseña en
        secreto y de los pedidos hechos desde tu cuenta.
      </p>

      <h2>2. Precios y pagos</h2>
      <ul>
        <li>Los precios están en pesos mexicanos e incluyen impuestos.</li>
        <li>
          El precio que pagas es el que aparece al confirmar tu pedido; si después cambia en el catálogo, tu
          pedido conserva el precio original.
        </li>
        <li>
          Un pedido queda <strong>pendiente</strong> hasta que se procesa el pago. Si el banco lo aprueba, pasa a{' '}
          <strong>pagado</strong> y apartamos tus ejemplares; si lo rechaza, el pedido queda{' '}
          <strong>rechazado</strong> y no se hace ningún cargo.
        </li>
        <li>
          Solo podemos vender los ejemplares disponibles. Si mientras pagas se agota un libro, el pago se rechaza
          sin cargo.
        </li>
      </ul>

      <h2>3. Envíos</h2>
      <ul>
        <li>Enviamos a cualquier dirección de la República Mexicana. El envío está incluido en el precio.</li>
        <li>
          Preparamos tu pedido después de confirmar el pago. El tiempo estimado de entrega es de 3 días a partir
          del pago; puede variar en zonas extendidas o en temporadas de mucha demanda.
        </li>
        <li>
          Puedes seguir tu pedido en «Tu cuenta» → «Mis pedidos»: en preparación, en camino o entregado.
        </li>
        <li>
          Revisa bien la dirección antes de pagar. Si el paquete regresa por una dirección incorrecta o porque
          nadie lo recibió, te contactaremos para reenviarlo.
        </li>
      </ul>

      <h2>4. Cancelaciones</h2>
      <p>
        Puedes cancelar tu pedido sin costo mientras siga <strong>en preparación</strong>, escribiéndonos a{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a> con el número de pedido. Te devolvemos el importe completo al
        mismo medio de pago. Una vez enviado ya no se puede cancelar, pero puedes devolverlo (ver el punto 5).
      </p>

      <h2>5. Devoluciones</h2>
      <ul>
        <li>Tienes 30 días naturales desde que recibes tu pedido para devolver un libro.</li>
        <li>
          El libro debe estar en el mismo estado en que lo recibiste: sin marcas, subrayados ni daños, y con su
          envoltura si la tenía.
        </li>
        <li>
          Si el libro llegó dañado o no es el que pediste, el envío de regreso corre por nuestra cuenta y puedes
          elegir entre un cambio o el reembolso completo.
        </li>
        <li>
          En cualquier otro caso, el envío de regreso corre por tu cuenta y te reembolsamos el precio del libro.
        </li>
        <li>Los reembolsos se hacen al mismo medio de pago en un plazo de hasta 10 días hábiles.</li>
      </ul>

      <h2>6. Contacto y aclaraciones</h2>
      <p>
        Para cualquier duda o queja escríbenos a <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Si no quedas
        satisfecho con nuestra respuesta, puedes acudir a la Procuraduría Federal del Consumidor (PROFECO).
      </p>
    </>
  )
}

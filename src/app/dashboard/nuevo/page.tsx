{/* AUTOCOMPLETAR CON IA 100% AUTOMÁTICO */}
{!editId && (
  <div className="card mb-4 border-purple-200 bg-purple-50">
    <div className="text-sm font-semibold text-purple-800 mb-1">⚡ Autocompletar con IA</div>
    <p className="text-xs text-purple-600 mb-2">Pegá el link de eBay y la IA va a buscar la información sola:</p>
    <div className="flex gap-2">
      <input 
        type="text"
        className="input bg-white border-purple-300 focus:border-purple-500 text-sm flex-1" 
        placeholder="https://www.ebay.com/itm/..." 
        value={f.link_producto}
        onChange={e => setF(p => ({ ...p, link_producto: e.target.value }))}
        disabled={loadingIA}
      />
      <button 
        type="button" 
        onClick={async () => {
          if (!f.link_producto.trim()) return
          setLoadingIA(true)
          const toastId = toast.loading('Descargando publicación y analizando con IA...')
          try {
            const res = await fetch('/api/parse-ebay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: f.link_producto })
            })
            const result = await res.json()
            if (result.success && result.data) {
              const d = result.data
              setF(prev => ({
                ...prev,
                pagina: 'eBay',
                producto: d.producto || prev.producto,
                marca: d.marca || prev.marca,
                anio: d.ano || prev.anio,
                modelo: d.modelo || prev.modelo,
                oem: d.oem || prev.oem,
                peso: d.peso ? d.peso.toString() : prev.peso,
              }))
              toast.success('¡Datos cargados con éxito!', { id: toastId })
            } else {
              toast.error(result.error || 'No se pudo extraer la información.', { id: toastId })
            }
          } catch (err) {
            toast.error('Error de conexión con la IA.', { id: toastId })
          } finally {
            setLoadingIA(false)
          }
        }}
        disabled={loadingIA || !f.link_producto.trim()}
        className="btn bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 text-sm rounded-lg"
      >
        {loadingIA ? 'Procesando...' : 'Completar Solo'}
      </button>
    </div>
  </div>
)}
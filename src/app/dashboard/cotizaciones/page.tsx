const nuevaCot = async () => {
    setEditId(null)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'cot' })
    setF({
      nro: 'COT-' + String(cnt || 1).padStart(3, '0'),
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: '', 
      cliente_nombre: '', 
      destino: 'AR', 
      vin: '',
      precio_final: 0
    })
    setCotItems([{ cantidad: 1, codigo: '', descripcion: '', peso: 0, basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli' }])
    setCliSearch('')
    setVista('form')
  }

  const editarCot = (cot: any) => {
    setEditId(cot.id)
    setF({
      nro: cot.nro, 
      fecha: cot.fecha || '',
      cliente_id: cot.cliente_id || '', 
      cliente_nombre: cot.cliente_nombre || '',
      destino: cot.destino || 'AR', 
      vin: cot.vin || '',
      precio_final: cot.precio_final || 0
    })
    setCliSearch(cot.cliente_nombre || '')
    setCotItems(cot.cotizacion_items || [])
    setVista('form')
  }

  const cancelar = () => {
    setEditId(null)
    setF({ nro: '', fecha: '', cliente_id: '', cliente_nombre: '', destino: 'AR', vin: '', precio_final: 0 })
    setCotItems([])
    setCliSearch('')
    setVista('lista')
  }
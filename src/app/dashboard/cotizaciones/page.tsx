{/* SECCIÓN DOCUMENTOS: CONTROL DE VISTA E IMPRESIÓN */}
            <div className="space-y-8">
              
              <div className="bg-white p-4 rounded-xl shadow border space-y-4 no-print">
                <div className="flex flex-wrap gap-4 items-center border-b pb-4">
                  <h3 className="font-bold text-sm text-gray-700">Seleccionar para imprimir:</h3>
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="checkbox" checked={imprConfig.cliente} onChange={e => setImprConfig({...imprConfig, cliente: e.target.checked})} />
                    <span>Cliente</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="checkbox" checked={imprConfig.basoli} onChange={e => setImprConfig({...imprConfig, basoli: e.target.checked})} />
                    <span>Básoli</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="checkbox" checked={imprConfig.partzilla} onChange={e => setImprConfig({...imprConfig, partzilla: e.target.checked})} />
                    <span>Partzilla</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="checkbox" checked={imprConfig.otras} onChange={e => setImprConfig({...imprConfig, otras: e.target.checked})} />
                    <span>Otras</span>
                  </label>
                </div>
                
                <div className="flex space-x-3">
                  <button onClick={() => window.print()} className="bg-gray-800 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-gray-900">
                    🖨️ Imprimir Selección
                  </button>
                  <button onClick={mandarWhatsApp} className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-green-700">
                    💬 WhatsApp
                  </button>
                </div>
              </div>

              {/* APLICAMOS LA LÓGICA DE VISIBILIDAD SEGÚN CHECKBOXES */}
              <div className={imprConfig.cliente ? 'block' : 'hidden'}>
                {/* [PEGA ACÁ EL BLOQUE DE "COTIZACIÓN PARA EL CLIENTE" QUE YA TENÍAS] */}
              </div>

              {/* BLOQUES DE DISTRIBUIDORES CON LA MISMA LÓGICA */}
              {imprConfig.basoli && deBasoli.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-white page-break">
                   {/* [CONTENIDO DE BÁSOLI] */}
                </div>
              )}
              {/* ETC... */}
            </div>

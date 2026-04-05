import { useState, useEffect } from 'react';
import { Download, Users, Search, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Layout from '@/react-app/components/Layout';
import { apiCall, useAuth } from '@/react-app/hooks/useAuth';
import { useToast } from '@/react-app/hooks/useToast';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import Pagination from '@/react-app/components/Pagination';

interface Contact {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
}

export default function AdminContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useToast();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (user?.organization_id) {
      fetchContacts();
    }
  }, [user]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = contacts.filter(contact => 
        contact.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.customer_phone.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
    setCurrentPage(1); // Volver a la página 1 al filtrar
  }, [contacts, searchTerm]);

  const fetchContacts = async () => {
    try {
      const response = await apiCall(`/api/admin/contacts?organization_id=${user?.organization_id}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
      } else {
        showError('Error', 'No se pudieron cargar los contactos');
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      showError('Error', 'Error de conexión al cargar contactos');
    } finally {
      setLoading(false);
    }
  };

  const downloadContacts = () => {
    // Mapear los datos para las cabeceras de Excel
    const exportData = filteredContacts.map(contact => ({
      'Nombre del Cliente': contact.customer_name,
      'Teléfono / WhatsApp': contact.customer_phone
    }));

    // Crear el libro de trabajo y la hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contactos");
    
    // Ajustar el ancho de las columnas
    const wscols = [
      { wch: 40 }, // Nombre
      { wch: 20 }  // Teléfono
    ];
    worksheet['!cols'] = wscols;

    // Generar el archivo y forzar su descarga
    XLSX.writeFile(workbook, `contactos_clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showSuccess('Éxito', 'Contactos descargados en Excel correctamente');
  };

  const handleDelete = (contact: Contact) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que quieres eliminar el contacto de "${contact.customer_name}"? Esta acción actualizará el cliente.`,
      onConfirm: async () => {
        try {
          const response = await apiCall(`/api/admin/contacts/${contact.customer_id}?organization_id=${user?.organization_id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            showSuccess('Éxito', 'Contacto eliminado correctamente');
            fetchContacts();
          } else {
            showError('Error', 'No se pudo eliminar el contacto');
          }
        } catch (error) {
          console.error('Error deleting contact:', error);
          showError('Error', 'Error de conexión al eliminar contacto');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Cálculos de paginación
  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
            <p className="text-gray-600">Lista de contactos únicos de tus clientes</p>
          </div>
          
          <div className="mt-4 lg:mt-0">
            <button 
              onClick={downloadContacts}
              disabled={filteredContacts.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar Contactos
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedContacts.map((contact, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{contact.customer_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{contact.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDelete(contact)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Eliminar contacto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
        </div>

        {filteredContacts.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay contactos</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm 
                ? 'No se encontraron contactos con los filtros aplicados.'
                : 'No hay contactos de clientes registrados.'
              }
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Users className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Total de contactos únicos</h4>
              <p className="text-sm text-blue-700 mt-1">
                Se muestran {filteredContacts.length} contactos únicos basados en números de teléfono.
              </p>
            </div>
          </div>
        </div>

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type="danger"
          confirmText="Eliminar"
          cancelText="Cancelar"
        />
      </div>
    </Layout>
  );
}
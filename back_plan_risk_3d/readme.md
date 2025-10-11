

# Crear entorno con conda
conda env create -f environment_full.yml
conda activate imageTo3D

# Instalar dependencias adicionales de pip
pip install -r requirements.txt


# Rara instalar para el login,logout, register
pip install djangorestframework-simplejwt


# En el Back Crear la carpeta en la raiz del back weights

Y pegar el Siguiente archivo: https://drive.google.com/file/d/14fDV0b_sKDg0_DkQBTyO1UaT6mHrW9es/view


## Para correr el back primero hay que:
    - Quitar HDF5
    $env:HDF5_DISABLE_VERSION_CHECK = '2'

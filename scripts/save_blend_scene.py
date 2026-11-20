import socket
import json

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(('127.0.0.1', 9876))
code = """
import bpy
bpy.ops.wm.save_as_mainfile(filepath=r"d:\\02_Projetos\\03_Hacking\\teste_REA\\perfil_sports\\app\\models\\kit_completo.blend")
"""
s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print(data.decode('utf-8'))
s.close()

from typing import List, Optional

from timdb.timdbbase import TimDbBase, TimDbException, blocktypes

ID_ROOT_FOLDER = -1

class Folders(TimDbBase):
    def create(self, name: str, owner_group_id: int) -> int:
        """Creates a new folder with the specified name.

        :param name: The name of the folder to be created.
        :param owner_group_id: The id of the owner group.
        :returns: The id of the newly created folder.
        """

        if '\0' in name:
            raise TimDbException('Folder name cannot contain null characters.')

        block_id = self.get_folder_id(name)
        if block_id is not None:
            return block_id

        cursor = self.db.cursor()
        block_id = self.insertBlockToDb(name, owner_group_id, blocktypes.FOLDER)

        rel_path, rel_name = self.split_location(name)
        cursor.execute("INSERT INTO Folder (id, name, location) VALUES (%s, %s, %s)", [block_id, rel_name, rel_path])
        self.db.commit()

        # Make sure that the parent folder exists
        # Note that get_folder_id calls create if it doesn't so there's implicit recursivity
        self.get_folder_id(rel_path, owner_group_id)

        return block_id

    def get_id(self, name: str) -> Optional[int]:
        """Gets the folders's identifier by its name or None if not found.

        :param name: The name of the folder.
        :returns: Integer block identifier.
        """
        cursor = self.db.cursor()
        cursor.execute('SELECT id FROM Folder WHERE name = %s', [name])
        row = cursor.fetchone()
        return row[0] if row is not None else None

    def get(self, block_id: int) -> Optional[dict]:
        """Gets the metadata information of the specified folder.

        :param document_id: The block id of the folder to be retrieved.
        :returns: A row representing the folder.
        """
        cursor = self.db.cursor()
        cursor.execute('SELECT id, name, location FROM Folder WHERE id = %s', [block_id])

        for folder in self.resultAsDictionary(cursor):
            folder['fullname'] = self.join_location(folder['location'], folder['name'])
            return folder

        return None

    def exists(self, folder_id: int) -> bool:
        """Checks whether a folder with the specified id exists.

        :param folder_id: The id of the folder.
        :returns: True if the folder exists, false otherwise.
        """
        cursor = self.db.cursor()
        cursor.execute('SELECT EXISTS(SELECT id FROM Folder WHERE id = %s)', [folder_id])
        return bool(int(cursor.fetchone()[0]))

    def get_folder_id(self, folder_name: str, create_with_owner_id: Optional[int] = None) -> Optional[int]:
        if folder_name == '':
            return ID_ROOT_FOLDER

        cursor = self.db.cursor()
        rel_loc, rel_name = self.split_location(folder_name)
        cursor.execute('SELECT id FROM Folder WHERE name = %s AND location = %s', [rel_name, rel_loc])
        result = cursor.fetchone()
        if result is None and create_with_owner_id is not None:
            #print("I created a folder record for " + folderName)
            return self.create(folder_name, create_with_owner_id)
        return result[0] if result is not None else None

    def get_folders(self, root_path: str = '') -> List[dict]:
        """Gets all the folders under a path.
        :returns: A list of dictionaries of the form {'id': <folder_id>, 'name': 'folder_name', 'fullname': 'folder_path'}
        """
        cursor = self.db.cursor()
        cursor.execute("SELECT id, name FROM Folder WHERE location = %s", [root_path])
        folders = self.resultAsDictionary(cursor)
        for folder in folders:
           folder['fullname'] = self.join_location(root_path, folder['name'])
        return folders

    def rename(self, block_id: int, new_name: str) -> None:
        """Renames a folder, updating all the documents within.

        :param block_id: The id of the folder to be renamed.
        :param new_name: The new name for the folder.
        """

        folder_info = self.get(block_id)
        assert folder_info is not None, 'folder does not exist: ' + str(block_id)
        old_name = folder_info['fullname']
        new_rel_path, new_rel_name = self.split_location(new_name)

        # Rename folder itself
        cursor = self.db.cursor()
        cursor.execute('UPDATE Folder SET name = %s, location = %s WHERE id = %s',
                       [new_rel_name, new_rel_path, block_id])

        # Rename contents
        cursor.execute('SELECT name FROM DocEntry WHERE name LIKE %s', [old_name + '/%'])
        for row in cursor.fetchall():
            old_docname = row[0]
            new_docname = old_docname.replace(old_name, new_name)
            cursor.execute('UPDATE DocEntry SET name = %s WHERE name = %s',
                           [new_docname, old_docname])

        cursor.execute('UPDATE Folder SET location = %s WHERE location = %s', [new_name, old_name])
        cursor.execute('SELECT location FROM Folder WHERE location LIKE %s', [old_name + '/%'])
        for row in cursor.fetchall():
            old_docname = row[0]
            new_docname = old_docname.replace(old_name, new_name)
            cursor.execute('UPDATE Folder SET location = %s WHERE location = %s',
                           [new_docname, old_docname])


        self.db.commit()

    def is_empty(self, block_id: int) -> bool:
        folder_info = self.get(block_id)
        assert folder_info is not None, 'folder does not exist: ' + str(block_id)
        folder_name = folder_info['fullname']

        cursor = self.db.cursor()
        cursor.execute('SELECT exists(SELECT name FROM DocEntry WHERE name LIKE %s)', [folder_name + '/%'])
        return cursor.fetchone()[0] == 0

    def delete(self, block_id: int) -> None:
        """Deletes an empty folder.
        """
        folder_info = self.get(block_id)
        assert folder_info is not None, 'folder does not exist: ' + str(block_id)
        folder_name = folder_info['fullname']

        # Check that our folder is empty
        assert self.is_empty(block_id), 'folder {} is not empty!'.format(folder_name)

        # Delete it
        cursor = self.db.cursor()
        cursor.execute('DELETE FROM Folder WHERE id = %s',
                       [block_id])
        cursor.execute('DELETE FROM Block WHERE type_id = %s AND id = %s',
                       [blocktypes.FOLDER, block_id])
        self.db.commit()
